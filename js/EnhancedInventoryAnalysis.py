import json
from pathlib import Path
from datetime import datetime
from collections import defaultdict

import pandas as pd


BASE_DIR = Path(__file__).resolve().parent.parent
INVENTORY_FILE = BASE_DIR / "Json" / "enhanced_per_sku_inventory.json"
SALES_FILE = BASE_DIR / "Data" / "POP_SalesTransactionHistory.csv"
TRANSFER_FILE = BASE_DIR / "Data" / "POP_InternalTransferHistory.XLSX"
OUTPUT_FILE = BASE_DIR / "Json" / "enhanced_per_sku_inventory_with_trends.json"


def normalize_sku(value):
    return str(value).strip().upper() if value is not None else ""


def safe_num(value, default=0.0):
    try:
        if pd.isna(value):
            return default
        return float(value)
    except Exception:
        return default


def safe_int(value, default=0):
    try:
        if pd.isna(value):
            return default
        return int(float(value))
    except Exception:
        return default


def parse_date(value):
    if pd.isna(value) or value is None or value == "":
        return None
    try:
        return pd.to_datetime(value, errors="coerce")
    except Exception:
        return None


def compute_trend(current, previous, threshold=0.15):
    if previous == 0 and current == 0:
        return "flat"
    if previous == 0 and current > 0:
        return "increasing"
    change = (current - previous) / max(previous, 1)
    if change > threshold:
        return "increasing"
    if change < -threshold:
        return "decreasing"
    return "flat"


def sell_out_risk(network_qty, recent_units_sold, days=30):
    daily_sales = recent_units_sold / max(days, 1)
    if daily_sales <= 0:
        return "low"

    days_of_cover = network_qty / daily_sales

    if days_of_cover < 30:
        return "high"
    if days_of_cover < 90:
        return "medium"
    return "low"


def load_inventory():
    with open(INVENTORY_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def load_sales_history():
    df = pd.read_csv(SALES_FILE, low_memory=False, dtype={"SOPNUMBE": "string", "ITEMNMBR": "string"})

    # Use the known column names from your CSV
    sku_col = "ITEMNMBR"
    qty_col = "QUANTITY_adj"
    date_col = "DOCDATE"

    if sku_col not in df.columns or qty_col not in df.columns or date_col not in df.columns:
        raise ValueError(
            f"Missing required sales columns. Found columns: {list(df.columns)}"
        )

    df[sku_col] = df[sku_col].apply(normalize_sku)
    df[qty_col] = pd.to_numeric(df[qty_col], errors="coerce").fillna(0)
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")

    df = df.dropna(subset=[sku_col, date_col])

    sales_by_sku = defaultdict(list)
    for _, row in df.iterrows():
        sales_by_sku[row[sku_col]].append(
            {
                "qty": float(row[qty_col]),
                "date": row[date_col],
            }
        )

    return sales_by_sku


def load_transfer_history():
    df = pd.read_excel(TRANSFER_FILE)

    sku_col = "Item Number"
    qty_col = "TRX QTY"
    date_col = "Document Date"
    type_col = "Document Type"
    from_loc_col = "TRX Location"
    to_loc_col = "Transfer To Location"

    required = [sku_col, qty_col, date_col]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(
            f"Missing required transfer columns: {missing}. Found columns: {list(df.columns)}"
        )

    df[sku_col] = df[sku_col].apply(normalize_sku)
    df[qty_col] = pd.to_numeric(df[qty_col], errors="coerce").fillna(0)
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")

    transfer_by_sku = defaultdict(list)
    for _, row in df.iterrows():
        transfer_by_sku[row[sku_col]].append(
            {
                "qty": float(row[qty_col]),
                "date": row[date_col],
                "direction": str(row.get(type_col, "")).strip().lower(),
                "from_location": str(row.get(from_loc_col, "")).strip(),
                "to_location": str(row.get(to_loc_col, "")).strip(),
            }
        )

    return transfer_by_sku


def summarize_sales(sales_rows):
    if not sales_rows:
        return {
            "recent_units_sold": 0,
            "prior_units_sold": 0,
            "sales_velocity_30d": 0,
            "trend": "flat",
            "sell_out_risk": "low",
        }

    now = pd.Timestamp.now()
    recent_30 = []
    prior_30 = []

    for row in sales_rows:
        dt = row["date"]
        if pd.isna(dt):
            continue
        days_ago = (now - dt).days
        if 0 <= days_ago <= 30:
            recent_30.append(row["qty"])
        elif 31 <= days_ago <= 60:
            prior_30.append(row["qty"])

    recent_units = sum(recent_30)
    prior_units = sum(prior_30)

    return {
        "recent_units_sold": round(recent_units, 2),
        "prior_units_sold": round(prior_units, 2),
        "sales_velocity_30d": round(recent_units / 30, 2),
        "trend": compute_trend(recent_units, prior_units),
        "sell_out_risk": None,  # filled later using inventory qty
    }


def summarize_transfers(transfer_rows):
    if not transfer_rows:
        return {
            "units_transferred_in": 0,
            "units_transferred_out": 0,
            "net_transfer_change": 0,
            "trend": "flat",
        }

    inbound = 0.0
    outbound = 0.0

    for row in transfer_rows:
        qty = abs(float(row["qty"]))
        direction = row["direction"]

        if "in" in direction and "out" not in direction:
            inbound += qty
        elif "out" in direction and "in" not in direction:
            outbound += qty
        else:
            # If direction isn't explicit, treat positive as inbound, negative as outbound
            if row["qty"] >= 0:
                inbound += qty
            else:
                outbound += qty

    return {
        "units_transferred_in": round(inbound, 2),
        "units_transferred_out": round(outbound, 2),
        "net_transfer_change": round(inbound - outbound, 2),
        "trend": compute_trend(inbound, outbound),
    }


def main():
    inventory = load_inventory()
    sales_by_sku = load_sales_history()
    transfer_by_sku = load_transfer_history()

    enhanced = []

    for item in inventory:
        sku = normalize_sku(item.get("sku"))

        sales_summary = summarize_sales(sales_by_sku.get(sku, []))
        transfer_summary = summarize_transfers(transfer_by_sku.get(sku, []))

        total_qty = safe_num(item.get("total_network_qty", 0))
        sales_summary["sell_out_risk"] = sell_out_risk(
            total_qty, sales_summary["recent_units_sold"], days=30
        )

        enriched_item = dict(item)
        enriched_item["sales_traction"] = sales_summary
        enriched_item["internal_transfer"] = transfer_summary

        enhanced.append(enriched_item)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(enhanced, f, indent=2, ensure_ascii=False)

    print(f"Written: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
