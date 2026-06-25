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

  await updateDoc(orderRef, {
    status: "Ready to Serve"
  });
}

function getDisplaySequence(order) {
  return Number.isFinite(Number(order.dailySequence))
    ? Number(order.dailySequence)
    : null;
}

function getOrderItems(order) {
  if (Array.isArray(order.items) && order.items.length > 0) {
    return order.items;
  }

  return [
    {
      foodName: order.foodName || "Unknown item",
      quantity: Number(order.quantity || 1),
      remarks: order.remarks || ""
    }
  ];
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
  const activeOrders = allOrders.filter((order) => order.status !== "Ready to Serve");
  const visibleOrders = showLiveQueueOnly ? activeOrders : allOrders;
  const sortedOrders = sortOrders(visibleOrders);

  liveQueueValue.textContent = showLiveQueueOnly
    ? `${activeOrders.length} active`
    : `${allOrders.length} total shown`;

  sortModeValue.textContent = sortMode === "sequence"
    ? "Tap for newest first"
    : "Tap for sequence order";

  readyHelperValue.textContent = highlightReadyActions
    ? `${activeOrders.length} waiting for action`
    : "Highlighting off";

  liveQueueToggle.classList.toggle("active", showLiveQueueOnly);
  sortModeToggle.classList.toggle("active", sortMode === "sequence");
  readyHelperToggle.classList.toggle("active", highlightReadyActions);
  ordersList.classList.toggle("helperMode", highlightReadyActions);

  if (sortedOrders.length === 0) {
    ordersList.innerHTML = `
      <div class="emptyState">
        <p class="eyebrow">No live orders</p>
        <h3>${showLiveQueueOnly ? "The live queue is clear for now." : "No orders found."}</h3>
        <p>${showLiveQueueOnly ? "New customer orders will appear here automatically." : "Try switching back to live queue mode after new orders arrive."}</p>
      </div>
    `;
    return;
  }

  ordersList.innerHTML = "";

  sortedOrders.forEach((order) => {
    const isReady = order.status === "Ready to Serve";
    const displaySequence = getDisplaySequence(order);
    const orderItems = getOrderItems(order);

    const totalQuantity = orderItems.reduce(
      (total, item) => total + Number(item.quantity || 0),
      0
    );

    const itemsHtml = orderItems
      .map(
        (item) => `
          <li>
            <span>
              ${item.foodName} <strong>x${Number(item.quantity || 1)}</strong>
              ${item.remarks ? `<small class="itemRemark">Remarks: ${item.remarks}</small>` : ""}
            </span>
          </li>
        `
      )
      .join("");

    const orderCard = document.createElement("article");
    orderCard.className = `orderCard ${highlightReadyActions && !isReady ? "actionFocus" : ""}`;

    orderCard.innerHTML = `
      <div class="orderCardTop">
        <div>
          <p class="orderId">${displaySequence ? `Order #${displaySequence}` : "Order in queue"}</p>
          <h3>${orderItems.length} item${orderItems.length === 1 ? "" : "s"}</h3>
        </div>
        <span class="statusPill ${isReady ? "readyPill" : "preparingPill"}">${order.status}</span>
      </div>

      <ul class="orderItemsList">
        ${itemsHtml}
      </ul>

      <div class="orderMetaGrid">
        <div>
          <p class="metaLabel">Total Qty</p>
          <strong>${totalQuantity || Number(order.quantity || 1)}</strong>
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

    orderCard.querySelector(".readyButton").addEventListener("click", async () => {
      if (!isReady) {
        await markReady(order.id);
      }
    });

    ordersList.appendChild(orderCard);
  });
}

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