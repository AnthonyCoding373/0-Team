"use strict";

// const buttons = document.querySelectorAll(".dashboard--button");
const buttonContainer = document.querySelector(".dashboard--info-container");

// buttonContainer.addEventListener("click", function (e) {
//   const targetButton = e.target;

//   if (targetButton.classList.contains("dashboard--button")) {
//     targetButton.classList.toggle("dashboard--button-active");
//   }
// });

// <div class="item" data-sku="${this.sku_id}">
//         <div class="item-header">
//           <h3 class="SKU-text">SKU: ${this.sku_id}</h3>
//           <div class="item-status">
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
        <div class="dc" data-id="${this.dc_id} data-sku${this.sku_id}">
          <div class="dc-header">
            <p class="dc-name">${this.dc_id}</p>
          </div>
          <div class="information">
            <p class="qty inf-text">Qty: ${this.quantity}</p>
            <p class="cost inf-text">Cost: $${this.cost}</p>
            <p class="total-value inf-text">Value: $${numberWithCommas(this.total_value)}</p>
            <p class="risk inf-text">Risk: $${this.risk}</p>
          </div>
        </div>
    `;
    return html;
  }
}

class item {
  #dcInfItems;
  constructor(sku_id, networkValue, dcInfItems) {
    this.sku_id = sku_id;
    this.networkValue = networkValue;
    this.dcInfItems = dcInfItems;
  }

  _getHTMLContent() {
    let html = `
      <div class="item" data-sku="134">
        <div class="item-header">
          <h3 class="SKU-text">SKU: A-61012</h3>
          <div class="item-status">
            <ion-icon
              class="icon healthy-icon"
              name="checkbox-outline"
            ></ion-icon>
            <h5 class="status-text">No action needed</h5>
          </div>
        </div>
        <p class="network-text">Total Network Value: $416,215.77</p>
        <div class="dc-container">
          <div class="dc-inf-container grid grid--col-3">
          </div>
        </div>
      </div>
    `;

    return html;
  }

  _createItem(dcINf) {
    const itemSKU = document.querySelector(`.item[data-sku=${this.sku_id}]`);
    this.itemSKU = itemSKU;

    this.items = itemSKU.querySelector("dc-inf-container");

    this.items.insertAdjacentHTML("afterbegin", dcINf._getHTMLContent());
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

class App {
  #map;
  #DCs;

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

  // _readData() {
  //   try {

  //   }
  // }

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

    console.log("open");

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
