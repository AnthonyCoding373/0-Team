import pandas as pd
from pathlib import Path

# Setup paths
base_path = Path(__file__).resolve().parent.parent.parent
excel_file = base_path / "Data" / "POP_AssemblyOrders.XLSX"
json_output = base_path / "js" / "inventory_summary.json"

try:
    df = pd.read_excel(excel_file)

    # 1. Group by Item and Location to get the current inventory totals
    # We sum 'TRX QTY' to see how much is at each DC
    summary = df.groupby(['Item Number', 'TRX Location']).agg({
        'TRX QTY': 'sum',
        'Unit Cost': 'mean',
        'Document Date': 'max' # See the last time this item moved
    }).reset_index()

    # 2. Rename columns for JS friendliness
    summary.columns = ['SKU', 'DC_ID', 'Total_Qty', 'Avg_Cost', 'Last_Movement']

    # 3. Save to JSON
    summary.to_json(json_output, orient='records', indent=4, date_format='iso')
    print(f"✅ Summary created! Found {len(summary)} unique SKU/Location pairs.")

except Exception as e:
    print(f"❌ Error: {e}")