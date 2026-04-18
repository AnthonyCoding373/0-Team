import json

# 1. Load your current aggregated data
with open('../../js/aggregated_inventory.json', 'r') as f:
    flat_data = json.load(f)

# The dictionary that will hold our grouped data
sku_map = {}

for entry in flat_data:
    sku = entry['sku']

    # If we haven't seen this SKU yet, initialize its object
    if sku not in sku_map:
        sku_map[sku] = {
            "sku": sku,
            "total_network_qty": 0,
            "total_network_value": 0,
            "locations": []
        }

    # 2. Add this location's data (including the specific unit cost)
    sku_map[sku]["locations"].append({
        "location": entry["location"],
        "qty": entry["total_qty"],
        "unit_cost": entry["avg_unit_cost"], # <--- Added this line
        "total_value": entry["total_value"]
    })

    # Update network-wide totals
    sku_map[sku]["total_network_qty"] += entry["total_qty"]
    sku_map[sku]["total_network_value"] += entry["total_value"]

# Convert the map back into a list of objects
per_sku_data = list(sku_map.values())

# 3. Save the new format
with open('../../js/per_sku_inventory.json', 'w') as f:
    json.dump(per_sku_data, f, indent=4)

print(f"✅ Transformed {len(flat_data)} lines into {len(per_sku_data)} unique SKU objects.")
print("Check your 'js/per_sku_inventory.json' for the unit_cost field!")