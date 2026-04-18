import json
from pathlib import Path
from collections import defaultdict

import pandas as pd


BASE_DIR = Path(__file__).resolve().parent.parent
INPUT_JSON = BASE_DIR / "Json" / "enhanced_per_sku_inventory_with_trends.json"
PURCHASE_ORDER_FILE = BASE_DIR / "Data" / "POP_PurchaseOrderHistory.XLSX"
SHIPMENT_STATUS_FILE = BASE_DIR / "Data" / "POP_ImportShipmentStatus.xlsx"
TRANSFER_REQUEST_FILE = BASE_DIR / "Data" / "POP_InternalTransferRequests.xlsx"
CHARGEBACK_FILE = BASE_DIR / "Data" / "POP_ChargeBack_Deductions_Penalties_Freight.xlsx"
OUTPUT_FILE = BASE_DIR / "Json" / "enhanced_inventory_decision_support.json"


def normalize(value):
    return str(value).strip().upper() if value is not None else ""


def clean_lower(value):
    return str(value).strip().lower() if value is not None else ""


def to_num(value, default=0.0):
    try:
        if pd.isna(value):
            return default
        return float(value)
    except Exception:
        return default


def to_date(value):
    try:
        if pd.isna(value) or value in ("", None):
            return pd.NaT
        return pd.to_datetime(value, errors="coerce")
    except Exception:
        return pd.NaT


def pick_any_column(df, contains_keywords):
    for col in df.columns:
        col_text = "" if col is None else str(col)
        low = col_text.lower()
        if all(k.lower() in low for k in contains_keywords):
            return col
    return None


def pick_column(df, candidates):
    lookup = {}
    for c in df.columns:
        key = "" if c is None else str(c).lower().strip()
        if key and key not in lookup:
            lookup[key] = c

    for cand in candidates:
        cand_key = str(cand).lower().strip()
        if cand_key in lookup:
            return lookup[cand_key]
    return None


def load_json_inventory():
    with open(INPUT_JSON, "r", encoding="utf-8") as f:
        return json.load(f)


def load_excel(path, **kwargs):
    return pd.read_excel(path, **kwargs)


def infer_location_from_row(row, location_cols):
    for col in location_cols:
        val = row.get(col, "")
        if pd.notna(val) and str(val).strip() != "":
            return normalize(val)
    return ""


def build_purchase_order_map():
    df = load_excel(PURCHASE_ORDER_FILE)

    sku_col = pick_column(df, ["Item Number", "Item", "SKU", "ITEMNMBR", "Product"])
    qty_col = pick_column(df, ["Order Quantity", "Qty", "Quantity", "Open Qty", "Remaining Qty"])
    eta_col = pick_column(df, ["Expected Arrival Date", "ETA", "Arrival Date", "Due Date", "Expected Date", "Promised Date"])
    status_col = pick_column(df, ["Status", "Order Status", "Document Status"])
    dc_col = pick_column(df, ["DC", "Location", "Ship To", "Warehouse", "TRX Location"])

    if not sku_col:
        raise ValueError(f"Could not identify SKU column in purchase order file. Columns: {list(df.columns)}")

    po_map = defaultdict(list)

    for _, row in df.iterrows():
        sku = normalize(row.get(sku_col))
        if not sku:
            continue

        qty = to_num(row.get(qty_col, 0)) if qty_col else 0
        eta = to_date(row.get(eta_col)) if eta_col else pd.NaT
        status = clean_lower(row.get(status_col, "")) if status_col else ""
        dc = normalize(row.get(dc_col, "")) if dc_col else ""

        # Drop useless placeholder rows
        if qty == 0 and pd.isna(eta) and not status and not dc:
            continue

        po_map[sku].append({
            "qty": qty,
            "eta": eta,
            "status": status,
            "dc": dc,
        })

    # Deduplicate and keep only one meaningful record per unique inbound event
    for sku, entries in list(po_map.items()):
        seen = set()
        deduped = []
        for e in entries:
            key = (
                round(float(e["qty"]), 2),
                None if pd.isna(e["eta"]) else e["eta"].strftime("%Y-%m-%d"),
                e["status"],
                e["dc"],
            )
            if key in seen:
                continue
            seen.add(key)
            deduped.append(e)
        po_map[sku] = deduped[:1]  # keep only the most relevant one

    return po_map


def build_shipment_delay_map():
    df = load_excel(SHIPMENT_STATUS_FILE)

    def _normalize_colname(value):
        text = str(value).strip().lower()
        text = text.replace("\n", " ")
        return " ".join(text.split())

    def _is_headerish_row(row):
        values = [_normalize_colname(v) for v in row.tolist() if pd.notna(v) and str(v).strip()]
        if not values:
            return False
        header_keywords = {
            "item", "item number", "sku", "itemnbr", "item nmbr", "product",
            "status", "shipment status", "document status", "expected arrival date",
            "eta", "arrival date", "due date", "expected date", "fda hold",
            "hold", "on hold", "delay", "delayed", "dc", "location", "warehouse",
            "receiving location"
        }
        return any(v in header_keywords for v in values)

    def _standardize_columns(dataframe):
        cleaned = []
        for c in dataframe.columns:
            name = str(c).strip()
            if name.startswith("Unnamed") or name == "":
                cleaned.append(name)
            else:
                cleaned.append(_normalize_colname(name))
        dataframe = dataframe.copy()
        dataframe.columns = cleaned
        return dataframe

    def _as_series(dataframe, col):
        """
        Return a single Series even if the DataFrame has duplicate column names.
        """
        selected = dataframe[col]
        if isinstance(selected, pd.DataFrame):
            selected = selected.iloc[:, 0]
        return selected

    # First pass: normalize current columns and try matching
    df = _standardize_columns(df)

    sku_col = pick_column(df, ["item number", "item", "sku", "itemnmb r", "itemnbr", "product", "item nmbr"])
    status_col = pick_column(df, ["status", "shipment status", "document status"])
    eta_col = pick_column(df, ["expected arrival date", "eta", "arrival date", "due date", "expected date"])
    hold_col = pick_column(df, ["fda hold", "hold", "on hold", "delay", "delayed"])
    dc_col = pick_column(df, ["dc", "location", "warehouse", "receiving location"])

    # Second pass: if SKU column is still missing, try to detect the real header row
    if not sku_col:
        raw = load_excel(SHIPMENT_STATUS_FILE, header=None)
        header_row_idx = None

        for i in range(min(len(raw), 25)):
            if _is_headerish_row(raw.iloc[i]):
                header_row_idx = i
                break

        if header_row_idx is not None:
            raw.columns = [str(x).strip() for x in raw.iloc[header_row_idx].tolist()]
            df = raw.iloc[header_row_idx + 1 :].copy()
            df.columns = [_normalize_colname(c) for c in raw.columns]
            df = _standardize_columns(df)

            sku_col = pick_column(df, ["item number", "item", "sku", "itemnmb r", "itemnbr", "product", "item nmbr"])
            status_col = pick_column(df, ["status", "shipment status", "document status"])
            eta_col = pick_column(df, ["expected arrival date", "eta", "arrival date", "due date", "expected date"])
            hold_col = pick_column(df, ["fda hold", "hold", "on hold", "delay", "delayed"])
            dc_col = pick_column(df, ["dc", "location", "warehouse", "receiving location"])

    if not sku_col:
        # As a fallback, try to identify a column that looks like SKU data by content
        for col in df.columns:
            series = _as_series(df, col).dropna().astype(str).head(20)
            if series.empty:
                continue
            non_empty = [s.strip() for s in series.tolist() if s.strip()]
            if not non_empty:
                continue
            # Prefer columns with alphanumeric identifiers rather than notes/labels
            if sum(any(ch.isdigit() for ch in v) for v in non_empty) >= max(1, len(non_empty) // 3):
                sku_col = col
                break

    if not sku_col:
        raise ValueError(
            f"Could not identify SKU column in shipment status file. Columns: {list(df.columns)}"
        )

    shipment_map = defaultdict(list)

    for _, row in df.iterrows():
        sku = normalize(row.get(sku_col))
        if not sku:
            continue

        status_text = clean_lower(row.get(status_col, "")) if status_col else ""
        hold_text = clean_lower(row.get(hold_col, "")) if hold_col else ""

        delay_flag = any(k in status_text for k in ["delay", "late", "hold"]) or any(
            k in hold_text for k in ["delay", "late", "hold", "fda"]
        )
        fda_hold_flag = "fda" in status_text or "fda" in hold_text

        eta = to_date(row.get(eta_col)) if eta_col else pd.NaT
        dc = normalize(row.get(dc_col, "")) if dc_col else ""

        # Drop useless placeholder rows
        if pd.isna(eta) and not status_text and not dc and not delay_flag and not fda_hold_flag:
            continue

        shipment_map[sku].append({
            "eta": eta,
            "status": status_text,
            "delay_flag": delay_flag,
            "fda_hold": fda_hold_flag,
            "dc": dc,
        })

    # Deduplicate and keep only one meaningful record per unique inbound event
    for sku, entries in list(shipment_map.items()):
        seen = set()
        deduped = []
        for e in entries:
            key = (
                None if pd.isna(e["eta"]) else e["eta"].strftime("%Y-%m-%d"),
                e["status"],
                bool(e["delay_flag"]),
                bool(e["fda_hold"]),
                e["dc"],
            )
            if key in seen:
                continue
            seen.add(key)
            deduped.append(e)
        shipment_map[sku] = deduped[:1]  # keep only the most relevant one

    return shipment_map



def build_transfer_request_map():
    df = load_excel(TRANSFER_REQUEST_FILE)

    def _norm_col(value):
        return clean_lower(value).replace("_", " ").strip()

    def _looks_like_title_row(values):
        joined = " ".join(_norm_col(v) for v in values)
        return (
                "wk of" in joined
                or "cut off" in joined
                or "report" in joined
                or ("inventory" in joined and "item" not in joined)
        )

    def _rebuild_with_detected_header(frame):
        """
        Try to locate a row that looks like the real header row and rebuild the
        dataframe using that row as column names.
        """
        header_keywords = {
            "item number", "item", "sku", "product", "quantity", "qty",
            "from dc", "from location", "source location", "to dc",
            "to location", "destination location", "status",
            "expected arrival date", "eta", "needed by", "due date",
            "arrival date", "trx qty", "itemnmbr", "transfer qty",
            "request status", "document status", "trx location",
            "transfer to location"
        }

        strong_header_markers = {
            "item number", "sku", "itemnmbr", "product", "qty", "quantity"
        }

        for idx, row in frame.iterrows():
            values = row.tolist()
            row_values = [_norm_col(v) for v in values]

            if not any(row_values):
                continue

            if _looks_like_title_row(values):
                continue

            matches = sum(
                1 for v in row_values
                if any(keyword in v for keyword in header_keywords)
            )

            strong_matches = sum(
                1 for v in row_values
                if any(marker == v or marker in v for marker in strong_header_markers)
            )

            if matches >= 2 or strong_matches >= 1:
                new_df = frame.iloc[idx + 1:].copy()
                new_df.columns = [str(v).strip() for v in values]
                new_df = new_df.reset_index(drop=True)
                return new_df

        return frame

    sku_candidates = ["Item Number", "Item", "SKU", "ITEMNMBR", "Product", "Item No", "Item #"]
    qty_candidates = ["Qty", "Quantity", "Requested Qty", "Transfer Qty", "TRX QTY", "Qty Requested"]
    from_candidates = ["From DC", "From Location", "Source Location", "TRX Location", "From"]
    to_candidates = ["To DC", "To Location", "Destination Location", "Transfer To Location", "To"]
    status_candidates = ["Status", "Request Status", "Document Status"]
    eta_candidates = ["Expected Arrival Date", "ETA", "Needed By", "Due Date", "Arrival Date"]

    sku_col = pick_column(df, sku_candidates)
    qty_col = pick_column(df, qty_candidates)
    from_dc_col = pick_column(df, from_candidates)
    to_dc_col = pick_column(df, to_candidates)
    status_col = pick_column(df, status_candidates)
    eta_col = pick_column(df, eta_candidates)

    if not sku_col:
        df = _rebuild_with_detected_header(df)
        sku_col = pick_column(df, sku_candidates)
        qty_col = qty_col or pick_column(df, qty_candidates)
        from_dc_col = from_dc_col or pick_column(df, from_candidates)
        to_dc_col = to_dc_col or pick_column(df, to_candidates)
        status_col = status_col or pick_column(df, status_candidates)
        eta_col = eta_col or pick_column(df, eta_candidates)

    # Final fallback: many export formats still need a positional interpretation
    if not sku_col and len(df.columns) > 0:
        sku_col = df.columns[0]
    if not qty_col and len(df.columns) > 1:
        qty_col = df.columns[1]

    if not sku_col:
        preview_cols = list(df.columns)
        raise ValueError(
            "Could not identify SKU column in transfer request file after trying to detect the header row. "
            f"Columns: {preview_cols}"
        )

    transfer_map = defaultdict(list)

    for _, row in df.iterrows():
        sku = normalize(row.get(sku_col))
        if not sku:
            continue

        qty = to_num(row.get(qty_col, 0)) if qty_col else 0
        from_dc = normalize(row.get(from_dc_col, "")) if from_dc_col else ""
        to_dc = normalize(row.get(to_dc_col, "")) if to_dc_col else ""
        status = clean_lower(row.get(status_col, "")) if status_col else ""
        eta = to_date(row.get(eta_col)) if eta_col else pd.NaT

        # Drop useless placeholder rows
        if qty == 0 and pd.isna(eta) and not from_dc and not to_dc and not status:
            continue

        transfer_map[sku].append({
            "qty": qty,
            "from_dc": from_dc,
            "to_dc": to_dc,
            "status": status,
            "eta": eta,
        })

    # Deduplicate and keep only one meaningful record per unique transfer event
    for sku, entries in list(transfer_map.items()):
        seen = set()
        deduped = []
        for e in entries:
            key = (
                round(float(e["qty"]), 2),
                e["from_dc"],
                e["to_dc"],
                e["status"],
                None if pd.isna(e["eta"]) else e["eta"].strftime("%Y-%m-%d"),
            )
            if key in seen:
                continue
            seen.add(key)
            deduped.append(e)
        transfer_map[sku] = deduped[:1]  # keep only the most relevant one

    return transfer_map


def build_chargeback_summary():
    df = load_excel(CHARGEBACK_FILE)

    def _looks_like_generic_headers(columns):
        cols = [str(c).strip() for c in columns]
        if not cols:
            return True

        # Common bad cases: 0,1,2... or blank/unnamed columns
        if all(c.isdigit() for c in cols):
            return True

        if all((not c) or c.lower().startswith("unnamed:") for c in cols):
            return True

        return False

    def _normalize_columns(frame):
        frame = frame.copy()
        frame.columns = ["" if c is None else str(c).strip() for c in frame.columns]
        frame = frame.rename(columns=lambda c: "" if str(c).startswith("Unnamed:") else c)
        return frame

    def _best_amount_candidate(frame):
        """
        Find the most likely amount column by looking for a numeric-heavy column
        with a meaningful spread of non-zero values.
        """
        candidates = []

        for col in frame.columns:
            series = _series_from_column(frame, col)
            if series is None:
                continue

            numeric_series = pd.to_numeric(series, errors="coerce")
            non_na = numeric_series.notna().mean() if len(numeric_series) else 0.0
            if non_na < 0.6:
                continue

            values = numeric_series.dropna().abs()
            if values.empty:
                continue

            median_val = float(values.median())
            max_val = float(values.max())
            if median_val <= 0 and max_val <= 0:
                continue

            # Prefer columns that look like money/amounts rather than IDs.
            candidates.append((col, non_na, median_val, max_val))

        if not candidates:
            return None

        # Highest numeric consistency first, then bigger monetary-like values.
        candidates.sort(key=lambda x: (x[1], x[2], x[3]), reverse=True)
        return candidates[0][0]

    # Normalize unnamed columns so fallback detection can work more reliably.
    df = _normalize_columns(df)

    # If the sheet was loaded with a bad header row or generic numeric headers,
    # try a more robust recovery path.
    if _looks_like_generic_headers(df.columns):
        raw = pd.read_excel(CHARGEBACK_FILE, header=None)
        if not raw.empty:
            first_row = ["" if pd.isna(v) else str(v).strip() for v in raw.iloc[0].tolist()]
            has_meaningful_headers = sum(1 for v in first_row if v) >= max(2, len(first_row) // 3)

            if has_meaningful_headers:
                raw.columns = first_row
                df = raw.iloc[1:].reset_index(drop=True)
            else:
                df = raw.copy()

        df = _normalize_columns(df)

    # Ensure all column names are safe to inspect, even if Excel produced numeric headers.
    df.columns = ["" if c is None else str(c).strip() for c in df.columns]

    sku_col = pick_column(df, ["SKU", "Item Number", "Item", "ITEMNMBR", "Product"])
    dc_col = pick_column(df, ["DC", "Location", "Warehouse", "TRX Location"])
    customer_col = pick_column(df, ["Customer", "CUSTNMBR", "Customer Name", "Account"])
    channel_col = pick_column(df, ["Channel", "Sales Channel", "Source", "Customer Type"])
    cause_col = pick_column(df, ["Cause Code", "Cause", "Reason Code", "Code"])
    amount_col = pick_column(df, ["Amount", "Chargeback Amount", "Penalty", "Deduction", "Cost", "Extended Cost"])
    date_col = pick_column(df, ["Date", "Transaction Date", "Document Date", "Posting Date"])
    type_col = pick_column(df, ["Type", "Chargeback Type", "Deduction Type", "Transaction Type", "Category"])

    def _series_from_column(frame, column_name):
        """
        Safely return a single Series for a column name.
        Handles duplicate column names or unusual Excel exports.
        """
        if column_name not in frame.columns:
            return None

        selected = frame.loc[:, column_name]
        if isinstance(selected, pd.DataFrame):
            # If duplicate columns exist, use the first one rather than failing.
            selected = selected.iloc[:, 0]
        return selected

    # Fallback: if no named amount column is found, try to infer one from numeric-looking data.
    if not amount_col:
        amount_col = _best_amount_candidate(df)

    # Last-resort fallback: if the data was loaded as a headerless matrix, inspect
    # the first few rows of each column and look for the strongest numeric pattern.
    if not amount_col and len(df.columns) > 0:
        raw_numeric_scores = []
        for col in df.columns:
            series = _series_from_column(df, col)
            if series is None:
                continue

            numeric_series = pd.to_numeric(series, errors="coerce")
            numeric_ratio = numeric_series.notna().mean() if len(numeric_series) else 0.0

            # Give a slight boost to columns that have repeated non-zero values
            # and look more like transaction amounts than identifiers.
            values = numeric_series.dropna().abs()
            if values.empty:
                continue

            spread = float(values.max() - values.min()) if len(values) > 1 else float(values.iloc[0])
            if numeric_ratio >= 0.5 and values.median() > 0:
                raw_numeric_scores.append((col, numeric_ratio, float(values.median()), spread))

        if raw_numeric_scores:
            raw_numeric_scores.sort(key=lambda x: (x[1], x[2], x[3]), reverse=True)
            amount_col = raw_numeric_scores[0][0]

    if not amount_col:
        raise ValueError(
            "Could not identify amount column in chargeback file. "
            f"Columns: {list(df.columns)}. "
            "Make sure the chargeback sheet has a clear header row and an amount/cost column."
        )

    def classify_chargeback(row):
        t = clean_lower(row.get(type_col, "")) if type_col else ""
        c = clean_lower(row.get(cause_col, "")) if cause_col else ""
        text = f"{t} {c}"
        planned = any(k in text for k in ["tpr", "promo", "promotion", "advertising allowance", "billback"])
        operational = any(k in text for k in ["short ship", "late", "damage", "mis-ship", "routing", "label", "compliance"])
        if planned:
            return "planned_promotional_deduction"
        if operational:
            return "operational_penalty"
        return "unknown"

    rows = []
    for _, row in df.iterrows():
        rows.append({
            "sku": normalize(row.get(sku_col, "")) if sku_col else "",
            "dc": normalize(row.get(dc_col, "")) if dc_col else "",
            "customer": normalize(row.get(customer_col, "")) if customer_col else "",
            "channel": normalize(row.get(channel_col, "")) if channel_col else "",
            "cause_code": normalize(row.get(cause_col, "")) if cause_col else "",
            "amount": to_num(row.get(amount_col, 0)),
            "date": to_date(row.get(date_col)) if date_col else pd.NaT,
            "type": classify_chargeback(row),
            "raw_type": clean_lower(row.get(type_col, "")) if type_col else "",
        })

    # Summary tables
    cause_summary = defaultdict(lambda: {"cost": 0.0, "count": 0})
    customer_summary = defaultdict(lambda: {"cost": 0.0, "count": 0})
    channel_summary = defaultdict(lambda: {"cost": 0.0, "count": 0})
    sku_summary = defaultdict(lambda: {"cost": 0.0, "count": 0})
    dc_summary = defaultdict(lambda: {"cost": 0.0, "count": 0})
    monthly_summary = defaultdict(lambda: {"cost": 0.0, "count": 0})

    for r in rows:
        amount = r["amount"]
        cause_summary[r["cause_code"]]["cost"] += amount
        cause_summary[r["cause_code"]]["count"] += 1
        customer_summary[r["customer"]]["cost"] += amount
        customer_summary[r["customer"]]["count"] += 1
        channel_summary[r["channel"]]["cost"] += amount
        channel_summary[r["channel"]]["count"] += 1
        sku_summary[r["sku"]]["cost"] += amount
        sku_summary[r["sku"]]["count"] += 1
        dc_summary[r["dc"]]["cost"] += amount
        dc_summary[r["dc"]]["count"] += 1
        if pd.notna(r["date"]):
            month_key = r["date"].strftime("%Y-%m")
            monthly_summary[month_key]["cost"] += amount
            monthly_summary[month_key]["count"] += 1

    def top_n(summary_dict, n=10):
        items = []
        for k, v in summary_dict.items():
            items.append({
                "key": k,
                "total_cost": round(v["cost"], 2),
                "count": int(v["count"]),
                "avg_cost": round(v["cost"] / max(v["count"], 1), 2),
            })
        items.sort(key=lambda x: x["total_cost"], reverse=True)
        return items[:n]

    total_cost = round(sum(r["amount"] for r in rows), 2)
    operational_cost = round(sum(r["amount"] for r in rows if r["type"] == "operational_penalty"), 2)
    planned_cost = round(sum(r["amount"] for r in rows if r["type"] == "planned_promotional_deduction"), 2)

    return {
        "rows": rows,
        "summary": {
            "total_chargeback_cost": total_cost,
            "operational_penalty_cost": operational_cost,
            "planned_promotional_deduction_cost": planned_cost,
            "top_cause_codes": top_n(cause_summary, 10),
            "top_customers": top_n(customer_summary, 10),
            "top_channels": top_n(channel_summary, 10),
            "top_skus": top_n(sku_summary, 10),
            "top_dcs": top_n(dc_summary, 10),
            "monthly_costs": [
                {"month": k, "total_cost": round(v["cost"], 2), "count": int(v["count"])}
                for k, v in sorted(monthly_summary.items())
            ],
        },
    }
def nearest_eta(entries):
    etas = [e["eta"] for e in entries if pd.notna(e.get("eta"))]
    return min(etas) if etas else pd.NaT


def compute_decision_support(item, po_map, shipment_map, transfer_map, chargeback_rows, location=None):
    sku = normalize(item.get("sku"))
    total_qty = float(item.get("total_network_qty", 0) or 0)

    po_entries = po_map.get(sku, [])
    shipment_entries = shipment_map.get(sku, [])
    transfer_entries = transfer_map.get(sku, [])
    relevant_chargebacks = [r for r in chargeback_rows if r["sku"] == sku]

    # inventory imbalance heuristics
    location_qtys = [loc.get("qty", 0) for loc in item.get("locations", [])]
    min_loc_qty = min(location_qtys) if location_qtys else 0
    max_loc_qty = max(location_qtys) if location_qtys else 0
    imbalance_score = max_loc_qty - min_loc_qty

    # If location is provided, compute location-specific quantity and imbalance context
    location_qty = None
    location_total_value = None
    if location is not None:
        location_qty = to_num(location.get("qty", 0))
        location_total_value = to_num(location.get("total_value", 0))

    # inbound timing
    po_eta = nearest_eta(po_entries)
    ship_eta = nearest_eta(shipment_entries)

    candidate_etas = [d for d in [po_eta, ship_eta] if pd.notna(d)]
    next_inbound_eta = min(candidate_etas) if candidate_etas else pd.NaT

    delay_risk = any(e.get("delay_flag") for e in shipment_entries)
    fda_hold = any(e.get("fda_hold") for e in shipment_entries)

    # transfer cost heuristic: use location qty if available, otherwise worst-case negative imbalance
    freight_cost_per_unit = 1.25

    if location_qty is not None:
        # If this location is negative or below a low-stock threshold, it may need transfer.
        shortage_qty = abs(location_qty) if location_qty < 0 else max(0, 25 - location_qty)
    else:
        shortage_qty = max(0, abs(min_loc_qty))

    estimated_transfer_cost = round(shortage_qty * freight_cost_per_unit, 2)

    # penalty exposure heuristic from chargeback history
    chargeback_cost = round(sum(r["amount"] for r in relevant_chargebacks), 2)
    operational_chargeback_cost = round(
        sum(r["amount"] for r in relevant_chargebacks if r["type"] == "operational_penalty"), 2
    )
    planned_deduction_cost = round(
        sum(r["amount"] for r in relevant_chargebacks if r["type"] == "planned_promotional_deduction"), 2
    )

    recent_sales = item.get("sales_traction", {})
    sell_out_risk = recent_sales.get("sell_out_risk", "low")
    sales_trend = recent_sales.get("trend", "flat")

    # simple risk scoring
    penalty_risk_estimate = chargeback_cost * 0.5
    if sell_out_risk == "high":
        penalty_risk_estimate *= 1.5
    if delay_risk or fda_hold:
        penalty_risk_estimate *= 1.4
    if sales_trend == "increasing":
        penalty_risk_estimate *= 1.25

    penalty_risk_estimate = round(penalty_risk_estimate, 2)

    # wait cost heuristic
    wait_cost = penalty_risk_estimate
    if pd.notna(next_inbound_eta):
        days_to_eta = max((next_inbound_eta - pd.Timestamp.now()).days, 0)
        if days_to_eta <= 3:
            wait_cost *= 0.75
        elif days_to_eta <= 7:
            wait_cost *= 0.9
        else:
            wait_cost *= 1.15
    else:
        # If there is no inbound ETA, waiting is riskier
        wait_cost *= 1.2

    wait_cost = round(wait_cost, 2)

    # Stronger recommendation logic:
    # - transfer if this location is short/negative and transfer is cheaper than waiting,
    #   or if there is no inbound soon.
    # - wait only if inbound is soon and the location is not short.
    inbound_soon = pd.notna(next_inbound_eta) and max((next_inbound_eta - pd.Timestamp.now()).days, 0) <= 7
    location_short = (location_qty is not None and location_qty <= 0) or (location_qty is not None and location_qty < 25)
    serious_imbalance = min_loc_qty < 0 or imbalance_score >= 1000

    if location_short and (not inbound_soon or estimated_transfer_cost <= wait_cost or serious_imbalance):
        recommendation = "transfer_now"
    elif wait_cost > estimated_transfer_cost * 1.25 and not inbound_soon:
        recommendation = "transfer_now"
    else:
        recommendation = "wait_for_inbound"

    # Make priority score reflect the urgency of the local location, not only SKU-wide totals
    location_pressure = 0
    if location_qty is not None:
        if location_qty < 0:
            location_pressure = abs(location_qty) * 0.1
        elif location_qty < 25:
            location_pressure = (25 - location_qty) * 0.05

    priority_score = round((wait_cost - estimated_transfer_cost) + (imbalance_score * 0.01) + location_pressure, 2)

    return {
        "sku": sku,
        "location": None if location is None else normalize(location.get("location")),
        "location_qty": round(location_qty, 2) if location_qty is not None else None,
        "location_total_value": round(location_total_value, 2) if location_total_value is not None else None,
        "imbalance_detected": imbalance_score > 0 or min_loc_qty < 0 or location_short,
        "imbalance_score": round(imbalance_score, 2),
        "estimated_transfer_cost": estimated_transfer_cost,
        "expected_penalty_cost_if_wait": wait_cost,
        "penalty_risk_estimate": penalty_risk_estimate,
        "recommendation": recommendation,
        "priority_score": priority_score,
        "inbound": {
            "next_inbound_eta": None if pd.isna(next_inbound_eta) else next_inbound_eta.strftime("%Y-%m-%d"),
            "delay_risk": bool(delay_risk),
            "fda_hold": bool(fda_hold),
            "purchase_orders": [
                {
                    "qty": round(e["qty"], 2),
                    "eta": None if pd.isna(e["eta"]) else e["eta"].strftime("%Y-%m-%d"),
                    "status": e["status"],
                    "dc": e["dc"],
                }
                for e in po_entries
            ],
            "shipment_status": [
                {
                    "eta": None if pd.isna(e["eta"]) else e["eta"].strftime("%Y-%m-%d"),
                    "status": e["status"],
                    "delay_flag": e["delay_flag"],
                    "fda_hold": e["fda_hold"],
                    "dc": e["dc"],
                }
                for e in shipment_entries
            ],
        },
        "chargeback_exposure": {
            "total_related_chargebacks": len(relevant_chargebacks),
            "total_related_cost": chargeback_cost,
            "operational_penalty_cost": operational_chargeback_cost,
            "planned_promotional_deduction_cost": planned_deduction_cost,
            "top_related_cause_codes": top_related_cause_codes(relevant_chargebacks),
        },
        "tradeoff": {
            "transfer_cost": estimated_transfer_cost,
            "wait_cost": wait_cost,
            "difference": round(wait_cost - estimated_transfer_cost, 2),
            "preferred_action": recommendation,
        },
        "transfer_requests": [
            {
                "qty": round(e["qty"], 2),
                "from_dc": e["from_dc"],
                "to_dc": e["to_dc"],
                "status": e["status"],
                "eta": None if pd.isna(e["eta"]) else e["eta"].strftime("%Y-%m-%d"),
            }
            for e in transfer_entries
        ],
    }

def top_related_cause_codes(relevant_chargebacks):
    summary = defaultdict(lambda: {"cost": 0.0, "count": 0})
    for r in relevant_chargebacks:
        code = r.get("cause_code", "") or "UNKNOWN"
        summary[code]["cost"] += r.get("amount", 0.0)
        summary[code]["count"] += 1

    items = []
    for code, val in summary.items():
        items.append({
            "cause_code": code,
            "total_cost": round(val["cost"], 2),
            "count": int(val["count"]),
        })
    items.sort(key=lambda x: x["total_cost"], reverse=True)
    return items[:10]


def main():
    inventory = load_json_inventory()
    po_map = build_purchase_order_map()
    shipment_map = build_shipment_delay_map()
    transfer_map = build_transfer_request_map()
    chargeback_data = build_chargeback_summary()

    chargeback_rows = chargeback_data["rows"]
    chargeback_summary = chargeback_data["summary"]

    enhanced = []
    decision_rank = []

    for item in inventory:
        enriched = dict(item)

        per_location_support = []
        for loc in enriched.get("locations", []):
            loc_support = compute_decision_support(
                enriched, po_map, shipment_map, transfer_map, chargeback_rows, location=loc
            )
            per_location_support.append(loc_support)

            if loc_support["imbalance_detected"]:
                decision_rank.append({
                    "sku": enriched.get("sku"),
                    "location": loc_support.get("location"),
                    "priority_score": loc_support["priority_score"],
                    "recommendation": loc_support["recommendation"],
                    "estimated_transfer_cost": loc_support["estimated_transfer_cost"],
                    "expected_penalty_cost_if_wait": loc_support["expected_penalty_cost_if_wait"],
                    "imbalance_score": loc_support["imbalance_score"],
                })

        enriched["decision_support_by_location"] = per_location_support

        # Optional backward-compatible summary at SKU level
        if per_location_support:
            enriched["decision_support_summary"] = max(
                per_location_support, key=lambda x: x["priority_score"]
            )

        enhanced.append(enriched)

    decision_rank.sort(key=lambda x: x["priority_score"], reverse=True)

    output = {
        "generated_from": "enhanced_per_sku_inventory_with_trends.json",
        "inventory": enhanced,
        "chargeback_analysis": chargeback_summary,
        "priority_imbalances": decision_rank[:100],
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Written: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
