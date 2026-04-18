async function startDashboard() {
    const container = document.getElementById('output');

    try {
        // Fetch the JSON created by Python
        const response = await fetch('./js/inventory_summary.json');

        if (!response.ok) throw new Error("Could not find the JSON file.");

        const data = await response.json();

        // Simple test: Create a list of the items
        let html = "<ul>";
        data.forEach(item => {
            html += `<li>SKU: ${item.SKU} | Qty: ${item.Total_Qty} at DC: ${item.DC_ID}</li>`;
        });
        html += "</ul>";

        container.innerHTML = html;

    } catch (err) {
        container.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
        console.error(err);
    }
}


startDashboard();