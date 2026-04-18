// async function startDashboard() {
//     const container = document.getElementById('output');
//
//     try {
//         // Fetch the JSON created by Python
//         const response = await fetch('./js/inventory_summary.json');
//
//         if (!response.ok) throw new Error("Could not find the JSON file.");
//
//         const data = await response.json();
//
//         // Simple test: Create a list of the items
//
//
//
//         // let html = "<ul>";
//         // data.forEach(item => {
//         //     html += `<li>SKU: ${item.SKU} | Qty: ${item.Total_Qty} at DC: ${item.DC_ID}</li>`;
//         // });
//         // html += "</ul>";
//
//         container.innerHTML = html;
//
//     } catch (err) {
//         container.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
//         console.error(err);
//     }
// }
//
//
// startDashboard();
async function loadDashboard() {
    const container = document.getElementById('output');

    try {
        const response = await fetch('./js/per_sku_inventory.json');
        const inventoryData = await response.json();

        let html = "<h2>Inventory Risk Dashboard</h2>";

        inventoryData.forEach(skuItem => {
            let dcDetailsHtml = "";
            let skuHasRisk = false;

            // Loop through each location for this specific SKU
            skuItem.locations.forEach(loc => {
                // Logic: Value at Risk only exists if qty is 0 or less
                let valueAtRisk = 0;
                if (loc.qty <= 0) {
                    // Use Math.abs to turn negative numbers positive for the calculation
                    valueAtRisk = Math.abs(loc.qty) * loc.unit_cost;
                    skuHasRisk = true;
                }

                dcDetailsHtml += `
                    <div style="flex: 1; border: 1px solid #eee; padding: 10px; border-radius: 4px; background: ${valueAtRisk > 0 ? '#fff0f0' : '#f0fff0'}">
                        <strong>DC ${loc.location}</strong><br>
                        Qty: ${loc.qty.toLocaleString()}<br>
                        Cost: $${loc.unit_cost.toFixed(2)}<br>
                        <span style="color: red; font-weight: bold;">
                            Risk: $${valueAtRisk.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </span>
                    </div>
                `;
            });

            // Build the main SKU Card
            html += `
                <div class="sku-card" style="border: 2px solid ${skuHasRisk ? 'red' : '#ccc'}; padding: 20px; margin-bottom: 20px; border-radius: 10px; font-family: sans-serif;">
                    <div style="display: flex; justify-content: space-between;">
                        <h3>SKU: ${skuItem.sku}</h3>
                        <h3 style="color: ${skuHasRisk ? 'red' : 'green'}">${skuHasRisk ? '🚨 ACTION REQUIRED' : '✅ HEALTHY'}</h3>
                    </div>
                    <p>Total Network Value: $${skuItem.total_network_value.toLocaleString()}</p>
                    <div style="display: flex; gap: 10px;">
                        ${dcDetailsHtml}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error("Error loading dashboard:", error);
        container.innerHTML = "Error loading inventory data.";
    }
}

loadDashboard();