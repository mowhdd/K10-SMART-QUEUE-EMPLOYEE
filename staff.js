import {
  db,
  collection,
  onSnapshot,
  doc,
  updateDoc,
  query,
  orderBy
} from "./firebase.js";

const ordersList = document.getElementById("ordersList");
const liveQueueToggle = document.getElementById("liveQueueToggle");
const sortModeToggle = document.getElementById("sortModeToggle");
const readyHelperToggle = document.getElementById("readyHelperToggle");
const liveQueueValue = document.getElementById("liveQueueValue");
const sortModeValue = document.getElementById("sortModeValue");
const readyHelperValue = document.getElementById("readyHelperValue");

const ordersQuery = query(collection(db, "orders"), orderBy("createdAt", "desc"));
let allOrders = [];
let showLiveQueueOnly = true;
let sortMode = "sequence";
let highlightReadyActions = true;

onSnapshot(ordersQuery, function(snapshot) {
  allOrders = snapshot.docs.map((documentData) => ({
    id: documentData.id,
    ...documentData.data()
  }));
  renderOrders();
});

async function markReady(orderId) {
  const orderRef = doc(db, "orders", orderId);
  await updateDoc(orderRef, { status: "Ready to Serve" });
}

function getDisplaySequence(order) {
  return Number.isFinite(Number(order.dailySequence))
    ? Number(order.dailySequence)
    : null;
}

function sortOrders(orders) {
  const sortedOrders = [...orders];

  if (sortMode === "newest") {
    return sortedOrders.sort((left, right) => {
      const leftCreatedAt = left.createdAt?.seconds || 0;
      const rightCreatedAt = right.createdAt?.seconds || 0;
      return rightCreatedAt - leftCreatedAt;
    });
  }

  return sortedOrders.sort((left, right) => {
    const leftDate = left.orderDateKey || "";
    const rightDate = right.orderDateKey || "";

    if (leftDate !== rightDate) {
      return rightDate.localeCompare(leftDate);
    }

    const leftSequence = getDisplaySequence(left) ?? Number.MAX_SAFE_INTEGER;
    const rightSequence = getDisplaySequence(right) ?? Number.MAX_SAFE_INTEGER;

    if (leftSequence !== rightSequence) {
      return leftSequence - rightSequence;
    }

    const leftCreatedAt = left.createdAt?.seconds || 0;
    const rightCreatedAt = right.createdAt?.seconds || 0;
    return leftCreatedAt - rightCreatedAt;
  });
}

function renderOrders() {
  ordersList.innerHTML = "";

  const activeOrders = showLiveQueueOnly
    ? allOrders.filter((o) => o.status !== "Ready to Serve")
    : allOrders;

  const sortedOrders = [...activeOrders].sort((a, b) => {
    if (sortMode === "sequence") {
      return (getDisplaySequence(a) || 0) - (getDisplaySequence(b) || 0);
    } else {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    }
  });

  liveQueueValue.textContent = `${activeOrders.filter(o => o.status !== "Ready to Serve").length} active`;

  if (sortedOrders.length === 0) {
    ordersList.innerHTML = `<p class="noOrdersMessage">No orders in queue.</p>`;
    return;
  }

  sortedOrders.forEach((order) => {
    const orderCard = document.createElement("div");
    orderCard.className = "orderCard";
    const isReady = order.status === "Ready to Serve";

    if (highlightReadyActions && !isReady) {
      orderCard.classList.add("actionRequired");
    }

    // Map through the array of items to group them under 1 order card safely
    let itemsHTML = "";
    if (order.items && Array.isArray(order.items)) {
      itemsHTML = order.items.map(item => `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; padding: 4px 0; border-bottom: 1px dashed var(--line);">
          <span>• ${item.foodName}</span>
          <strong>x${item.quantity}</strong>
        </div>
      `).join("");
    } else {
      // Fallback for older documents in your database
      itemsHTML = `<div>• ${order.foodName || "Unknown Item"} <strong>x${order.quantity || 1}</strong></div>`;
    }

    orderCard.innerHTML = `
      <div class="orderCardHeader">
        <span class="orderNumber">#${getDisplaySequence(order) || "—"}</span>
        <span class="statusLabel ${isReady ? "statusReady" : "statusPreparing"}">${order.status}</span>
      </div>
      
      <div class="orderTitle" style="margin: 12px 0; font-size: 0.95rem; color: var(--text);">
        ${itemsHTML}
      </div>

      <div class="orderMetaGrid">
        <div>
          <p class="metaLabel">Total Qty</p>
          <strong>${order.totalQuantity || order.quantity || 1}</strong>
        </div>
        <div>
          <p class="metaLabel">Session</p>
          <strong>${order.customerSessionId ? order.customerSessionId.slice(-4).toUpperCase() : "Walk-in"}</strong>
        </div>
      </div>
      <button class="primaryButton readyButton" data-order-id="${order.id}" ${isReady ? "disabled" : ""}>
        ${isReady ? "Marked Ready" : "Ready to Serve"}
      </button>
    `;

    const readyButton = orderCard.querySelector(".readyButton");
    readyButton.addEventListener("click", async () => {
      if (isReady) return;
      await markReady(order.id);
    });

    ordersList.appendChild(orderCard);
  });
}

  sortedOrders.forEach((order) => {
    const orderCard = document.createElement("div");
    orderCard.className = "orderCard";
    const isReady = order.status === "Ready to Serve";

    if (highlightReadyActions && !isReady) {
      orderCard.classList.add("actionRequired");
    }

    // --- FIX: Map through the array of items to group them under 1 order card ---
    let itemsHTML = "";
    if (order.items && Array.isArray(order.items)) {
      itemsHTML = order.items.map(item => `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; padding: 4px 0; border-bottom: 1px dashed var(--line);">
          <span>• ${item.foodName}</span>
          <strong>x${item.quantity}</strong>
        </div>
      `).join("");
    } else {
      // Fallback for older orders that didn't have the array structure
      itemsHTML = `<div>• ${order.foodName || "Unknown Item"} <strong>x${order.quantity || 1}</strong></div>`;
    }
    // ---------------------------------------------------------------------------

    orderCard.innerHTML = `
      <div class="orderCardHeader">
        <span class="orderNumber">#${getDisplaySequence(order) || "—"}</span>
        <span class="statusLabel ${isReady ? "statusReady" : "statusPreparing"}">${order.status}</span>
      </div>
      
      <div class="orderTitle" style="margin: 12px 0; font-size: 0.95rem; color: var(--text);">
        ${itemsHTML}
      </div>

      <div class="orderMetaGrid">
        <div>
          <p class="metaLabel">Total Qty</p>
          <strong>${order.totalQuantity || order.quantity || 1}</strong>
        </div>
        <div>
          <p class="metaLabel">Session</p>
          <strong>${order.customerSessionId ? order.customerSessionId.slice(-4).toUpperCase() : "Walk-in"}</strong>
        </div>
      </div>
      <button class="primaryButton readyButton" data-order-id="${order.id}" ${isReady ? "disabled" : ""}>
        ${isReady ? "Marked Ready" : "Ready to Serve"}
      </button>
    `;

    const readyButton = orderCard.querySelector(".readyButton");
    readyButton.addEventListener("click", async () => {
      if (isReady) return;
      await markReady(order.id);
    });

    ordersList.appendChild(orderCard);
  });
}

  ordersList.innerHTML = "";

  sortedOrders.forEach((order) => {
    const isReady = order.status === "Ready to Serve";
    const displaySequence = getDisplaySequence(order);

    const orderCard = document.createElement("article");
    orderCard.className = `orderCard ${highlightReadyActions && !isReady ? "actionFocus" : ""}`;
    orderCard.innerHTML = `
      <div class="orderCardTop">
        <div>
          <p class="orderId">${displaySequence ? `Order #${displaySequence}` : "Order in queue"}</p>
          <h3>${order.foodName}</h3>
        </div>
        <span class="statusPill ${isReady ? "readyPill" : "preparingPill"}">${order.status}</span>
      </div>
      <div class="orderMetaGrid">
        <div>
          <p class="metaLabel">Quantity</p>
          <strong>${order.quantity}</strong>
        </div>
      </div>
      ${order.remarks ? `<p class="remarksText">Remarks: ${order.remarks}</p>` : `<p class="remarksText">Remarks: None</p>`}
      <button class="primaryButton readyButton" data-order-id="${order.id}" ${isReady ? "disabled" : ""}>
        ${isReady ? "Marked Ready" : "Ready to Serve"}
      </button>
    `;

    orderCard.querySelector(".readyButton").addEventListener("click", async () => {
      if (!isReady) {
        await markReady(order.id);
      }
    });

    ordersList.appendChild(orderCard);
  });


liveQueueToggle.addEventListener("click", () => {
  showLiveQueueOnly = !showLiveQueueOnly;
  liveQueueToggle.querySelector(".summaryTitle").textContent = showLiveQueueOnly ? "Live queue" : "All orders";
  renderOrders();
});

sortModeToggle.addEventListener("click", () => {
  sortMode = sortMode === "sequence" ? "newest" : "sequence";
  sortModeToggle.querySelector(".summaryTitle").textContent = sortMode === "sequence" ? "Sequence order" : "Newest orders first";
  renderOrders();
});

readyHelperToggle.addEventListener("click", () => {
  highlightReadyActions = !highlightReadyActions;
  renderOrders();
});
