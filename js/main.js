"use strict";

// const buttons = document.querySelectorAll(".dashboard--button");
const buttonContainer = document.querySelector(".dashboard--info-container");
const dcContainer = document.querySelector(".item-section");

// buttonContainer.addEventListener("click", function (e) {
//   const targetButton = e.target;

//   if (targetButton.classList.contains("dashboard--button")) {
//     targetButton.classList.toggle("dashboard--button-active");
//   }
// });

// <div class="" data-sku="${this.sku_id}">
//         <div class="-header">
//           <h3 class="SKU-text">SKU: ${this.sku_id}</h3>
//           <div class="-status">
//             <ion-icon
//               class="icon ${risk > 0 ? "warning-icon-" : "healthy-icon"} "
//               name="checkbox-outline"
//             ></ion-icon>
//             <h5 class="status-text">${risk > 0 ? "Action needed" : "No action needed"}</h5>
//           </div>
//         </div>

function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

class dcInf {
  constructor(sku_id, dc_id, quantity, cost, risk, total_value) {
    this.sku_id = sku_id;
    this.dc_id = dc_id;
    this.quantity = quantity;
    this.cost = cost;
    this.risk = risk;
    this.total_value = total_value;
  }

  _getHTMLContent() {
    let html = `
        <div class="dc" data-id${this.sku_id}">
          <div class="dc-header">
            <p class="dc-name">${locations[this.dc_id]}</p>
          </div>
          <div class="information">
            <p class="qty inf-text">Qty: ${this.quantity}</p>
            <p class="cost inf-text">Cost: $${this.cost.toFixed(2)}</p>
            <p class="total-value inf-text">Value: $${this.total_value.toFixed(2)}</p>
            <p class="risk inf-text">Risk: $${this.risk.toFixed(2)}</p>
          </div>
        </div>
    `;
    return html;
  }
}

class Item {
  #dcInfs;
  constructor(sku_id, networkValue) {
    this.sku_id = sku_id;
    this.networkValue = networkValue;
    this.#dcInfs = [];

    // this._create();
  }

  _pushDC(dcInf) {
    this.#dcInfs.push(dcInf);
  }

  _getDCString() {
    let html = "";

    this.#dcInfs.forEach((dc) => {
      // console.log(dc);
      // console.log(dc._getHTMLContent());
      html += dc._getHTMLContent();
    });

    // console.log(html);
    return html;
  }

  _getItemStatus() {
    let html = `
    
    <div class="item-status">
      <ion-icon
        class="icon healthy-icon"
        name="checkbox-outline"
      ></ion-icon>
      <h5 class="status-text">No action needed</h5>
    </div>
    
    `;

    return html;
  }

  _getHTMLContent() {
    let html = `
        <div class="item" data-id="${this.sku_id}">
            <div class="item-header">
              <h3 class="SKU-text">SKU: ${this.sku_id}</h3>
              ${this._getItemStatus()}
            </div>
            <p class="network-text">Total Network Value: $${this.networkValue.toFixed(2)}</p>
            <div class="dc-container">
              <div class="dc-inf-container grid grid--col-3">
                ${this._getDCString()}
              </div>
            </div>
            `;
    // <div class="dc" data-id="${this.sku_id}">
    //   <div class="-header">
    //     <h3 class="SKU-text">SKU: ${this.sku_id}</h3>
    //     <div class="-status">
    //       <ion-icon
    //         class="icon healthy-icon"
    //         name="checkbox-outline"
    //       ></ion-icon>
    //       <h5 class="status-text">No action needed</h5>
    //     </div>
    //   </div>
    //   <p class="network-text">Total Network Value: $${this.networkValue}</p>
    //   <div class="dc-container">
    //     <div class="dc-inf-container grid grid--col-3">
    //     ${this._getDCString()}
    //     </div>
    //   </div>
    // </div>

    // console.log(html);

    return html;
  }

  _create(dcINf) {
    // console.log(dcINf._getHTMLContent());
    // const SKU = document.querySelector(`.item[data-id="${this.sku_id}"]`)
    dcContainer.insertAdjacentHTML("afterbegin", dcINf._getHTMLContent());
  }
}

class DC {
  constructor(id, severe, medium, coords) {
    this.id = id;
    this.severe = severe;
    this.medium = medium;
    this.coords = coords;
    this._setUpButton();
  }

  _setMarker(marker) {
    this.marker = marker;
  }

  _setButtonText() {
    const severe = this.button.querySelector(".warning--text-severe");
    const medium = this.button.querySelector(".warning--text-medium");

    severe.textContent = this.severe;
    medium.textContent = this.medium;
  }

  _setUnSelected() {
    this.button.classList.remove("dashboard--button-active");
  }

  _setSelected() {
    this.button.classList.add("dashboard--button-active");
  }

  _setUpButton() {
    this.button = document.querySelector(`#${this.id}`);
    console.log(this.button);
    this._setButtonText();
  }
}

const locations = ["LA", "OKL", "TE"];

class App {
  #map;
  #DCs;
  #items = [];

  constructor(...DCS) {
    this.#DCs = [...DCS];
    this.currentDC;

    this._getPosition();
    this._readData();
    // this._rendorMapMarkers();
    // Event Listeners
    buttonContainer.addEventListener("click", this._handleDC.bind(this));
  }

  _getMapHTMLContent(dc) {
    let HTML = `
      <div class = "popup-icon-div" data-id = "${dc.id}">
      <p class>${dc.id}</p>
      <div class="status-indicator">
        <div class="warning-medium warning">
          <p class="warning--text warning--text-severe">${dc.severe}</p>
          <ion-icon
            name="warning-outline"
            class="icon icon--severe"
          ></ion-icon>
        </div>
        <div class="warning-severe warning">
          <p class="warning--text warning--text-medium">${dc.medium}</p>
          <ion-icon
            name="alert-circle-outline"
            class="icon icon--medium"
          ></ion-icon>
        </div>
      </div>
    `;

    return HTML;
  }

  async _readData() {
    try {
      const response = await fetch(
        "./Json/enhanced_per_sku_inventory_with_trends.json",
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(data);

      data.forEach((d) => {
        const skuID = d.sku;
        const networkValue = d.total_network_value;
        const newItem = new Item(skuID, networkValue);
        const locations = d.locations;

        const maxSize = locations.length;

        locations.forEach((loc, i) => {
          if (i >= maxSize) return;

          const newDCLoc = new dcInf(
            skuID,
            i,
            loc.qty,
            loc.unit_cost,
            loc.penalty_risk_estimate,
            loc.unit_cost * loc.qty,
          );
          newItem._pushDC(newDCLoc);
          // console.log(newDCLoc);
        });

        this.#items.push(newItem);

        newItem._create(newItem);
      });
    } catch (err) {
      console.log(err);
    }
  }

  _rendorItems() {
    this.#items.forEach((item) => {
      dcContainer.insertAdjacentHTML("afterbegin", item._getHTMLContent());
    });
  }

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
  //         // Simple test: Create a list of the s
  //
  //
  //
  //         // let html = "<ul>";
  //         // data.forEach( => {
  //         //     html += `<li>SKU: ${.SKU} | Qty: ${.Total_Qty} at DC: ${.DC_ID}</li>`;
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
  // async function loadDashboard() {
  //     const container = document.getElementById('output');

  //     try {
  //         const response = await fetch('./js/per_sku_inventory.json');
  //         const inventoryData = await response.json();

  //         let html = "<h2>Inventory Risk Dashboard</h2>";

  //         inventoryData.forEach(sku => {
  //             let dcDetailsHtml = "";
  //             let skuHasRisk = false;

  //             // Loop through each location for this specific SKU
  //             sku.locations.forEach(loc => {
  //                 // Logic: Value at Risk only exists if qty is 0 or less
  //                 let valueAtRisk = 0;
  //                 if (loc.qty <= 0) {
  //                     // Use Math.abs to turn negative numbers positive for the calculation
  //                     valueAtRisk = Math.abs(loc.qty) * loc.unit_cost;
  //                     skuHasRisk = true;
  //                 }

  //                 dcDetailsHtml += `
  //                     <div style="flex: 1; border: 1px solid #eee; padding: 10px; border-radius: 4px; background: ${valueAtRisk > 0 ? '#fff0f0' : '#f0fff0'}">
  //                         <strong>DC ${loc.location}</strong><br>
  //                         Qty: ${loc.qty.toLocaleString()}<br>
  //                         Cost: $${loc.unit_cost.toFixed(2)}<br>
  //                         <span style="color: red; font-weight: bold;">
  //                             Risk: $${valueAtRisk.toLocaleString(undefined, {minimumFractionDigits: 2})}
  //                         </span>
  //                     </div>
  //                 `;
  //             });

  //             // Build the main SKU Card
  //             html += `
  //                 <div class="sku-card" style="border: 2px solid ${skuHasRisk ? 'red' : '#ccc'}; padding: 20px; margin-bottom: 20px; border-radius: 10px; font-family: sans-serif;">
  //                     <div style="display: flex; justify-content: space-between;">
  //                         <h3>SKU: ${sku.sku}</h3>
  //                         <h3 style="color: ${skuHasRisk ? 'red' : 'green'}">${skuHasRisk ? '🚨 ACTION REQUIRED' : '✅ HEALTHY'}</h3>
  //                     </div>
  //                     <p>Total Network Value: $${sku.total_network_value.toLocaleString()}</p>
  //                     <div style="display: flex; gap: 10px;">
  //                         ${dcDetailsHtml}
  //                     </div>
  //                 </div>
  //             `;
  //         });

  //         container.innerHTML = html;

  //     } catch (error) {
  //         console.error("Error loading dashboard:", error);
  //         container.innerHTML = "Error loading inventory data.";
  //     }
  // }

  // loadDashboard();

  _rendorMapMarkers(dc) {
    const popUpObject = L.popup({
      maxWidth: 250,
      maxHeight: 100,
      autoClose: false,
      closeOnClick: false,
      className: `${dc.id}-popup`,
    });
    const marker = L.marker(dc.coords)
      .addTo(this.#map)
      .bindPopup(popUpObject)
      .setPopupContent(this._getMapHTMLContent(dc))
      .openPopup();

    dc._setMarker(marker);

    marker.on("click", (e) => {
      console.log(e);
      // popUpObject.options.offset = e.target.options.icon.options.popupAnchor;
      // popUpObject.setContent("TEST").setLatLng(e.target.getLatLng()).addTo(map);
      // marker.openPopup();
      this._handleSidebarSelectionDC(dc);
      this._movetoPopup();
    });
    // var popup = L.popup({
    //   closeOnClick: false,
    //   autoClose: false,
    //   closeButton: true,
    // });
    // //your function from above
    // const newMarker = new L.marker(dc.coords, { draggable: true }).addTo(map);
    // newMarker.on("click", (e) => {
    //   popup.options.offset = e.target.options.icon.options.popupAnchor;
    //   popup.setContent("TEST").setLatLng(e.target.getLatLng()).addTo(map);
    // });
  }

  _handleSidebarSelectionDC(dc) {
    this.#DCs.forEach((element) => {
      if (dc === element) {
        this.currentDC = element;
        element._setSelected();
      } else {
        element._setUnSelected();
      }
    });
  }

  _handleSidebarSelection(dashboardID) {
    this.#DCs.forEach((element) => {
      if (dashboardID === element.id) {
        this.currentDC = element;
        element._setSelected();
      } else {
        element._setUnSelected();
      }
    });
  }

  _handleDC(e) {
    const dashboardID = e.target.dataset.id;

    if (!dashboardID) return;

    this._handleSidebarSelection(dashboardID);

    console.log(dashboardID, this.#DCs);

    this._movetoPopup();
  }

  _movetoPopup() {
    if (!this.currentDC) return;

    this.currentDC.marker.openPopup();

    this.#map.setView(this.currentDC.coords, 10, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // console.log("open");

    // workout.click();
  }

  _findDCS(id) {
    return this.#DCs.find((dc) => dc.id === id);
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert("Could not get your position");
        },
      );
    }
  }

  _loadMap(position) {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;

    const coords = [latitude, longitude];

    this.#map = L.map("map").setView(coords, 5);

    //   L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    //     attribution:
    //       '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    //   }).addTo(map);

    //   L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    //     attribution:
    //       '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    //   }).addTo(map);

    L.tileLayer(
      "https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.{ext}",
      {
        minZoom: 0,
        maxZoom: 20,
        attribution:
          '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        ext: "png",
      },
    ).addTo(this.#map);

    // this.#map.on("click", this._showForm.bind(this));

    this.#DCs.forEach((dc) => {
      this._rendorMapMarkers(dc);
    });
  }
}

const tempCoords = [33.6592153, -117.7975974];
const tempCoords1 = [33.9, -118];

const LADC = new DC("LA", 7, 5, tempCoords);
const OKLDC = new DC("OKL", 3, 4, tempCoords1);

const app = new App(LADC, OKLDC);
