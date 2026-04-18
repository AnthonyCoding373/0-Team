"use strict";

// const buttons = document.querySelectorAll(".dashboard--button");
const buttonContainer = document.querySelector(".dashboard--info-container");
const dcContainer = document.querySelector(".item-section");
const sortBy = document.querySelector(".sort-by");
const btnsWarning = document.querySelectorAll(".warning-btn");
const itmSection = document.querySelector(".item-section");
const detailsSection = document.querySelector(".item-section-details");

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

const severe = [0, 0, 0];
const medium = [0, 0, 0];

function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

class dcInf {
  constructor(
    sku_id,
    dc_id,
    quantity,
    cost,
    risk,
    total_value,
    recommended_action,
    priority,
    estimated_transfer_cost,
    expected_penalty_cost_if_wait,
  ) {
    this.sku_id = sku_id;
    this.dc_id = dc_id;
    this.quantity = quantity;
    this.cost = cost;
    this.risk = risk;
    this.total_value = total_value;
    this.recommended_action = recommended_action;
    this.priority = priority;
    this.estimated_transfer_cost = estimated_transfer_cost;
    this.expected_penalty_cost_if_wait = expected_penalty_cost_if_wait;
  }

  _getIsAtRisk() {
    console.log(this.recommended_action, this.risk);

    if (this.recommended_action === "transfer_now" && this.risk > 200) {
      this.RiskLevel = 2;
      return 2;
    }

    if (
      this.recommended_action === "wait_for_inbound" &&
      (this.risk > 0 || (this.priority > 500 && this.quantity <= 800))
    ) {
      this.RiskLevel = 1;
      return 1;
    }

    this.RiskLevel = 0;
    return 0;
  }

  _getHTMLContent() {
    console.log("Called", `${this.RiskLevel > 0 ? "dc-risk" : ""}`);
    let html = `
        <div class="dc ${this.RiskLevel > 0 ? "dc-risk" : ""}" data-id= "${this.sku_id}" data-ind = "${this.dc_id}">
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

  _getItemDC(i) {
    return this.#dcInfs[i];
  }

  _calcAmount() {
    this.#dcInfs.forEach((it, i) => {
      // console.log("C", it);

      // if (it.RiskLevel > 0) {
      //   console.log("DFDFDF");
      // }

      if (it.RiskLevel > 1) {
        severe[i] += 1;
      } else if (it.RiskLevel) {
        medium[i] += 1;
      }
    });

    console.log(severe, medium);
  }

  _pushDC(dcInf) {
    this.#dcInfs.push(dcInf);
  }

  _setRiskVisual(dc) {
    // console.log("in", dc.RiskLevel);
    if (Number(dc.RiskLevel) > 0) {
      console.log(dc.sku_id);
      const value = document.querySelector(`.dc[data-id="${dc.sku_id}"]`);
      value.classList.add("dc-risk");
      // console.log(value);
    }
  }

  _getRiskLevel() {
    let currentRiskLevel = 0;

    this.#dcInfs.forEach((dc) => {
      const val = dc._getIsAtRisk();
      // this._setRiskVisual(dc);
      if (val > currentRiskLevel) {
        currentRiskLevel = val;
      }
    });

    // this.risk = currentRiskLevel;
    return currentRiskLevel;
  }

  _setRiskVisuals() {
    this.#dcInfs.forEach((dc) => {
      // const val = dc._getIsAtRisk();
      this._setRiskVisual(dc);
    });
  }

  _getRiskText() {
    const result = this._getRiskLevel();
    this.RiskLevel = result;
    // console.log("risk", result);

    if (result === 0) {
      return `
      <ion-icon
        class="icon healthy-icon"
        name="checkbox-outline"
      ></ion-icon>
      <h5 class="status-text">No action needed</h5>
      `;
    } else if (result === 1) {
      // return `
      // <ion-icon
      //   class="icon healthy-icon"
      //   name="checkbox-outline"
      // ></ion-icon>
      // <h5 class="status-text">No action needed</h5>
      // `;
      return `                       
        <ion-icon
          name="alert-circle-outline"
          class="icon warning-icon--"
        ></ion-icon>
        <h5 class="status-text">Warning</h5>
      `;
    } else if (result === 2) {
      return `
          <ion-icon
            class="icon warning-icon-"
            name="warning-outline"
          ></ion-icon>
          <h5 class="status-text">Action needed</h5>
      `;
    }
  }

  _getDCString() {
    let html = "";

    this.#dcInfs.forEach((dc, i) => {
      if (i > 2) return;
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
      ${this._getRiskText()}
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

  _create() {
    // console.log(dcINf._getHTMLContent());
    // const SKU = document.querySelector(`.item[data-id="${this.sku_id}"]`)
    dcContainer.insertAdjacentHTML("afterbegin", this._getHTMLContent());
  }
}

class DC {
  constructor(id, severe, medium, coords, ind) {
    this.id = id;
    this.severe = severe;
    this.medium = medium;
    this.coords = coords;
    this._setUpButton();
    this.ind = ind;
  }

  _setMarker(marker) {
    this.marker = marker;
  }

  _setButtonText() {
    const sever = this.button.querySelector(".warning--text-severe");
    const med = this.button.querySelector(".warning--text-medium");

    console.log("BAB", severe, medium);

    sever.textContent = severe[this.ind];
    med.textContent = medium[this.ind];
  }

  _setUnSelected() {
    this.button.classList.remove("dashboard--button-active");
  }

  _setSelected() {
    this.button.classList.add("dashboard--button-active");
  }

  _setUpButton() {
    this.button = document.querySelector(`#${this.id}`);
    // console.log(this.button);
  }
}

let laSevere = 0;
let laMed = 0;
let OKLSever = 0;
let OKLMed = 0;
let TESever = 0;
let TEMed = 0;

const locations = ["LA", "OKL", "TE"];

class App {
  #map;
  #DCs;
  #items = [];

  constructor(...DCS) {
    this.#DCs = [...DCS];
    this.currentDC;

    this._readData();

    this._getPosition();

    // this._rendorMapMarkers();
    // Event Listeners
    buttonContainer.addEventListener("click", this._handleDC.bind(this));
    sortBy.addEventListener("click", this._handleSort.bind(this));
    itmSection.addEventListener("click", this._handleDCClicked.bind(this));
  }

  _findItem(sku_i) {
    return this.#items.find((t) => t.sku_id == sku_i);
  }

  _createDetails(dataId, dataInd) {
    const item = this._findItem(dataId);
    console.log(item);
    const dcItem = item._getItemDC(dataInd);

    // this.recommended_action = recommended_action;
    // this.priority = priority;
    // this.estimated_transfer_cost = estimated_transfer_cost;
    // this.expected_penalty_cost_if_wait = expected_penalty_cost_if_wait;

    let html = `
    
      <div class="item-section container">
        <div class="item details-back" data-sku="134">
          <div class="item-header cust">
            <h3 class="SKU-text">${locations[dataInd]}<span class="SKU-text-form">&middot; SKU: ${dataId}</span></h3>
            <div class="item-status">
              <h5 class="status-text recom">Recommended: ${dcItem.recommended_action}</h5>
            </div>
          </div>
          <p class="network-text expec">Expected Penalty with No Action: <span class="total">$${dcItem.expected_penalty_cost_if_wait}</span></p>
          <p class="network-text trans">Estimated Transfer Cost: <span class="total">$${dcItem.estimated_transfer_cost}</span></p>
          <p class="network-text pri">Priority: <span>${dcItem.priority}</span></p>
      </div>

    `;

    detailsSection.insertAdjacentHTML("afterbegin", html);
  }

  _activateDetails() {
    itmSection.classList.add("hidden-sec");
    detailsSection.classList.remove("hidden-sec");
  }

  _activateItemsSections() {
    detailsSection.classList.add("hidden-sec");
    itmSection.classList.remove("hidden-sec");
  }

  _createDCElement(dataId, dataInd) {
    detailsSection.innerHTML = "";
  }

  _handleDCClicked(e) {
    const dcObject = e.target.closest(".dc");
    if (dcObject) {
      const dataId = dcObject.dataset.id;
      const dataInd = dcObject.dataset.ind;
      console.log(dataId, dataInd);
      this._activateDetails();
      this._createDetails(dataId, dataInd);
    }
  }

  _calcAmt() {
    console.log("ba", this.#items);

    this.#items.forEach((it, i) => {
      it._calcAmount();
      // TESever += it._getTESevere();
      // TEMed += it._getTEMedium();
    });

    console.log(medium);
    console.log(severe);
  }

  _handleSort(e) {
    const target = e.target.closest(".warning-btn");

    if (!target) return;

    // console.log(target.classList.contains("warning-btn"));

    if (!target.classList.contains("warning-btn")) return;

    console.log(e.target);

    btnsWarning.forEach((bt) => {
      if (bt === target) {
        bt.classList.add("overview-btn-active");
      } else {
        bt.classList.remove("overview-btn-active");
      }
    });

    console.log(target.dataset.num);

    this._reorderData(target.dataset.num);
  }

  _getMapHTMLContent(dc, i) {
    let sever = severe[i];
    let med = medium[i];

    let HTML = `
      <div class = "popup-icon-div" data-id = "${dc.id}">
      <p class>${dc.id}</p>
      <div class="status-indicator">
        <div class="warning-medium warning">
          <p class="warning--text warning--text-severe">${sever}</p>
          <ion-icon
            name="warning-outline"
            class="icon icon--severe"
          ></ion-icon>
        </div>
        <div class="warning-severe warning">
          <p class="warning--text warning--text-medium">${med}</p>
          <ion-icon
            name="alert-circle-outline"
            class="icon icon--medium"
          ></ion-icon>
        </div>
      </div>
    `;

    return HTML;
  }

  _reorderData(type) {
    const dcInfContainer = document.querySelector(".item-section");
    if (type == 0) {
      dcInfContainer.innerHTML = "";

      const result = this.#items.toSorted((a, b) => {
        console.log(a.RiskLevel);
        if (a.RiskLevel < b.RiskLevel) return 1;
        if (a.RiskLevel > b.RiskLevel) return -1;
        return 0;
      });

      result.forEach((it) => it._create());
    }

    if (type == 1) {
      const result = this.#items.toSorted((a, b) => {
        if (a.RiskLevel == 1) {
          return 100;
        } else if (b.RiskLevel == 1) {
          return -100;
        }

        if (a.RiskLevel < b.RiskLevel) return -1;
        if (a.RiskLevel > b.RiskLevel) return 1;
        return 0;
      });

      result.forEach((it) => {
        console.log("BA");
        console.log(it.RiskLevel);
        it._create();
      });
    }

    if (type == 2) {
      dcInfContainer.innerHTML = "";

      const result = this.#items.toSorted((a, b) => {
        console.log(a.RiskLevel);
        if (a.RiskLevel < b.RiskLevel) return -1;
        if (a.RiskLevel > b.RiskLevel) return 1;
        return 0;
      });

      result.forEach((it) => it._create());
    }
  }

  async _readData() {
    try {
      const response = await fetch(
        "./Json/enhanced_inventory_decision_support.json",
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      // console.log("hello");
      console.log(data);

      data.inventory.forEach((d) => {
        const skuID = d.sku;
        const networkValue = d.total_network_value;
        const newItem = new Item(skuID, networkValue);
        const locations = d.locations;

        const maxSize = locations.length;

        const arrayVal = [];

        locations.forEach((loc, i) => {
          if (i >= maxSize) return;

          // console.log(loc);
          // console.log(loc.decision_support);
          const expected_support_summary =
            loc.decision_support.estimated_transfer_cost;
          // console.log(expected_support_summary);
          // console.log(loc.decision_support.recommendation);

          const newDCLoc = new dcInf(
            skuID,
            i,
            loc.qty,
            loc.unit_cost,
            expected_support_summary,
            loc.qty * loc.unit_cost,
            loc.decision_support.recommendation,
            loc.decision_support.priority_score,
            loc.decision_support.estimated_transfer_cost,
            loc.decision_support.expected_penalty_cost_if_wait,
          );

          newItem._pushDC(newDCLoc);
          // console.log(newDCLoc);
        });

        this.#items.push(newItem);
      });
    } catch (err) {
      console.log(err);
    }
    this.#items.forEach((it) => it._create());

    // setTimeout(this._reorderData.bind(this, 1), 5000);
  }

  _rendorItems() {
    this.#items.forEach((item) => {
      dcContainer.insertAdjacentHTML("afterbegin", item._getHTMLContent());
    });

    _setRiskVisuals();
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

  _rendorMapMarkers(dc, i) {
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
      .setPopupContent(this._getMapHTMLContent(dc, i))
      .openPopup();

    dc._setMarker(marker);

    dc._setButtonText();

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

    // console.log(dashboardID, this.#DCs);

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

    this._calcAmt();

    this.#DCs.forEach((dc, i) => {
      this._rendorMapMarkers(dc, i);
    });
  }
}

const tempCoords = [33.6592153, -117.7975974];
const tempCoords1 = [33.9, -118];

const LADC = new DC("LA", 7, 5, tempCoords, 0);
const OKLDC = new DC("OKL", 3, 4, tempCoords1, 1);

const app = new App(LADC, OKLDC);
