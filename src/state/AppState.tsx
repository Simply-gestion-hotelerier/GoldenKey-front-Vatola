import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type Department = "hotel" | "restaurant" | "pub" | "spa";

export type RoomStatus = "occupied" | "clean" | "dirty" | "inspected" | "out-of-order";

export type Room = {
  id: number;
  number: string;
  type: "Standard" | "Deluxe" | "Suite";
  status: RoomStatus;
  guest?: string | null;
  checkoutAt?: string | null;
  image_url?: string | null;
};

export type OrderStatus = "open" | "closed" | "cancelled";
export type FireStatus = "commanded" | "preparing" | "delivered";

export type OrderLine = {
  id: number;
  item_id: number;
  item_name: string;
  qty: number;
  unit_price?: number; // Ar
  instructions?: string;
  fire_status: FireStatus;
  fired_at?: string | null;
  prepared_at?: string | null;
  delivered_at?: string | null;
};

export type Order = {
  id: number;
  dept_id: Department;
  table_id: string;
  waiter_id?: number | null;
  status: OrderStatus;
  opened_at: string;
  closed_at?: string | null;
  lines: OrderLine[];
};

export type TabStatus = "open" | "paid" | "unpaid";
export type Tab = {
  id: number;
  dept_id: Department; // expected "pub"
  customer_name: string;
  status: TabStatus;
  balance: number; // Ar
};

export type AppointmentStatus =
  | "booked"
  | "in_progress"
  | "completed"
  | "no_show"
  | "cancelled";

export type Appointment = {
  id: number;
  service_id: number;
  staff_id: number;
  guest: string;
  start: string; // ISO
  end: string; // ISO
  room?: string;
  status: AppointmentStatus;
  service_name: string;
  price: number; // Ar
};

// Inventory
export type Store = { id: number; name: string; department: Department };
export type Item = {
  id: number;
  sku: string;
  name: string;
  unit: "piece" | "kg" | "g" | "L" | "cl" | "ml";
  vat_rate: number; // %
  cost_price: number; // Ar
  sale_price_default: number; // Ar
  is_active: boolean;
  is_menu?: boolean;
  menu_dept?: Department | null;
};
export type Stock = {
  id: number;
  store_id: number;
  item_id: number;
  qty_on_hand: number;
  min_level: number;
  max_level: number;
};
export type StockMoveType = "IN" | "OUT" | "CONSUME" | "ADJUST";
export type StockMovement = {
  id: number;
  store_id: number;
  item_id: number;
  type: StockMoveType;
  qty: number;
  unit_cost?: number;
  reason?: string;
  ref?: string;
  created_at: string;
};

// Cash sessions
export type CashSession = {
  id: number;
  department_id: Department;
  opened_by: string;
  opened_at: string;
  closed_by?: string | null;
  closed_at?: string | null;
  opening_float: number; // Ar
  closing_amount?: number | null; // Ar
  status: "open" | "closed";
};

export type AppState = {
  rooms: Room[];
  orders: Order[];
  tabs: Tab[];
  appointments: Appointment[];
  stores: Store[];
  items: Item[];
  stocks: Stock[];
  stock_movements: StockMovement[];
  cash_sessions: CashSession[];
  // actions Rooms
  setRoomStatus: (roomId: number, status: RoomStatus) => void;
  checkIn: (roomId: number, guest: string, checkoutAt: string) => void;
  checkOut: (roomId: number) => void;
  addRoom: (room: Omit<Room, "id">) => number;
  bulkAddRooms: (start: number, end: number, type: Room["type"]) => void;
  updateRoom: (roomId: number, data: Partial<Omit<Room, "id">>) => void;
  deleteRoom: (roomId: number) => void;
  // actions Orders
  addOrder: (o: Omit<Order, "id">) => number;
  addOrderLine: (orderId: number, line: Omit<OrderLine, "id">) => number;
  setOrderLineStatus: (orderId: number, lineId: number, status: FireStatus) => void;
  closeOrder: (orderId: number) => void;
  // actions Tabs
  addTab: (t: Omit<Tab, "id">) => number;
  payTab: (tabId: number, amount: number) => void;
  markTabUnpaid: (tabId: number) => void;
  // actions Spa
  setAppointmentStatus: (id: number, status: AppointmentStatus) => void;
  // actions Inventory
  stockMove: (m: Omit<StockMovement, "id" | "created_at">) => void;
  addItem: (item: Omit<Item, "id">) => number;
  updateItem: (itemId: number, data: Partial<Omit<Item, "id">>) => void;
  deleteItem: (itemId: number) => void;
  addStock: (stock: Omit<Stock, "id">) => number;
  updateStock: (stockId: number, data: Partial<Omit<Stock, "id">>) => void;
  // actions Cash
  openCashSession: (dept: Department, opening_float: number, opened_by: string) => number;
  closeCashSession: (sessionId: number, closing_amount: number, closed_by: string) => void;
};

const AppStateContext = createContext<AppState | null>(null);

function nowIso() {
  return new Date().toISOString();
}

// Seeds
const seedRooms: Room[] = Array.from({ length: 20 }).map((_, i) => {
  const num = 101 + i;
  const type: Room["type"] = num % 10 === 1 ? "Suite" : num % 2 === 0 ? "Deluxe" : "Standard";
  const status: RoomStatus = i % 5 === 0 ? "occupied" : i % 5 === 1 ? "dirty" : i % 5 === 2 ? "clean" : i % 5 === 3 ? "inspected" : "out-of-order";
  return {
    id: i + 1,
    number: String(num),
    type,
    status,
    guest: status === "occupied" ? (num % 2 === 0 ? "Mme Martin" : "M. Dupont") : null,
    checkoutAt: status === "occupied" ? "Demain" : null,
  };
});

let rid = seedRooms.length + 1;

let oid = 1000;
let lid = 10000;
let tid = 2000;
let aid = 3000;
let itid = 4000;
let stid = 5000;
let smid = 6000;
let csid = 7000;

const seedOrders: Order[] = [
  {
    id: oid++,
    dept_id: "restaurant",
    table_id: "R5",
    status: "open",
    opened_at: nowIso(),
    lines: [
      { id: lid++, item_id: 45, item_name: "Menu du jour", qty: 2, unit_price: 25000, fire_status: "preparing", fired_at: nowIso() },
      { id: lid++, item_id: 12, item_name: "Vin rouge", qty: 1, unit_price: 18000, fire_status: "commanded" },
    ],
  },
  {
    id: oid++,
    dept_id: "restaurant",
    table_id: "R12",
    status: "open",
    opened_at: nowIso(),
    lines: [
      { id: lid++, item_id: 33, item_name: "Pizza Margherita", qty: 1, unit_price: 22000, fire_status: "commanded" },
      { id: lid++, item_id: 22, item_name: "Salade César", qty: 1, unit_price: 16000, fire_status: "delivered", delivered_at: nowIso() },
    ],
  },
  {
    id: oid++,
    dept_id: "pub",
    table_id: "B3",
    status: "open",
    opened_at: nowIso(),
    lines: [
      { id: lid++, item_id: 77, item_name: "Bière pression", qty: 2, unit_price: 7000, fire_status: "delivered", delivered_at: nowIso() },
    ],
  },
];

const seedTabs: Tab[] = [
  { id: tid++, dept_id: "pub", customer_name: "Table 1", status: "unpaid", balance: 24500 },
  { id: tid++, dept_id: "pub", customer_name: "Comptoir 3", status: "open", balance: 45000 },
  { id: tid++, dept_id: "pub", customer_name: "Table 5", status: "paid", balance: 0 },
];

const seedAppointments: Appointment[] = [
  {
    id: aid++,
    service_id: 1,
    staff_id: 10,
    guest: "Mme Dubois",
    start: new Date(new Date().setHours(14, 0, 0, 0)).toISOString(),
    end: new Date(new Date().setHours(15, 0, 0, 0)).toISOString(),
    room: "Cabine 1",
    status: "booked",
    service_name: "Massage relaxant",
    price: 85000,
  },
  {
    id: aid++,
    service_id: 2,
    staff_id: 11,
    guest: "M. Laurent",
    start: new Date(new Date().setHours(15, 30, 0, 0)).toISOString(),
    end: new Date(new Date().setHours(16, 15, 0, 0)).toISOString(),
    room: "Cabine 2",
    status: "in_progress",
    service_name: "Soin visage",
    price: 65000,
  },
  {
    id: aid++,
    service_id: 3,
    staff_id: 12,
    guest: "Mme Chen",
    start: new Date(new Date().setHours(16, 15, 0, 0)).toISOString(),
    end: new Date(new Date().setHours(16, 45, 0, 0)).toISOString(),
    room: "Onglerie",
    status: "booked",
    service_name: "Manucure française",
    price: 35000,
  },
];

const seedStores: Store[] = [
  { id: 1, name: "Magasin Hôtel", department: "hotel" },
  { id: 2, name: "Cuisine", department: "restaurant" },
  { id: 3, name: "Bar", department: "pub" },
  { id: 4, name: "Spa", department: "spa" },
];

const seedItems: Item[] = [
  { id: itid++, sku: "RIZ-001", name: "Riz", unit: "kg", vat_rate: 20, cost_price: 3000, sale_price_default: 0, is_active: true },
  { id: itid++, sku: "POU-001", name: "Poulet", unit: "kg", vat_rate: 20, cost_price: 9000, sale_price_default: 0, is_active: true },
  { id: itid++, sku: "BIER-DRF", name: "Bière pression", unit: "cl", vat_rate: 20, cost_price: 300, sale_price_default: 7000, is_active: true },
  { id: itid++, sku: "VNRG-075", name: "Vin rouge 75cl", unit: "piece", vat_rate: 20, cost_price: 25000, sale_price_default: 18000, is_active: true },
  { id: itid++, sku: "SAVON-SPA", name: "Huile massage", unit: "ml", vat_rate: 20, cost_price: 50, sale_price_default: 0, is_active: true },
];

const seedStocks: Stock[] = [
  { id: stid++, store_id: 2, item_id: seedItems[0].id, qty_on_hand: 50, min_level: 20, max_level: 200 },
  { id: stid++, store_id: 2, item_id: seedItems[1].id, qty_on_hand: 30, min_level: 10, max_level: 100 },
  { id: stid++, store_id: 3, item_id: seedItems[2].id, qty_on_hand: 120, min_level: 50, max_level: 500 },
  { id: stid++, store_id: 3, item_id: seedItems[3].id, qty_on_hand: 18, min_level: 10, max_level: 50 },
  { id: stid++, store_id: 4, item_id: seedItems[4].id, qty_on_hand: 2000, min_level: 500, max_level: 5000 },
];

const seedCashSessions: CashSession[] = [
  { id: csid++, department_id: "restaurant", opened_by: "Manager", opened_at: nowIso(), opening_float: 50000, status: "open" },
];

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [rooms, setRooms] = useState<Room[]>(seedRooms);
  const [orders, setOrders] = useState<Order[]>(seedOrders);
  const [tabs, setTabs] = useState<Tab[]>(seedTabs);
  const [appointments, setAppointments] = useState<Appointment[]>(seedAppointments);
  const [stores] = useState<Store[]>(seedStores);
  const [items, setItems] = useState<Item[]>(seedItems);
  const [stocks, setStocks] = useState<Stock[]>(seedStocks);
  const [stock_movements, setStockMovements] = useState<StockMovement[]>([]);
  const [cash_sessions, setCashSessions] = useState<CashSession[]>(seedCashSessions);

  // Rooms
  const setRoomStatus = useCallback((roomId: number, status: RoomStatus) => {
    setRooms((rs) => rs.map((r) => (r.id === roomId ? { ...r, status } : r)));
  }, []);

  const checkIn = useCallback((roomId: number, guest: string, checkoutAt: string) => {
    setRooms((rs) => rs.map((r) => (r.id === roomId ? { ...r, status: "occupied", guest, checkoutAt } : r)));
  }, []);

  const checkOut = useCallback((roomId: number) => {
    setRooms((rs) => rs.map((r) => (r.id === roomId ? { ...r, status: "dirty", guest: null, checkoutAt: null } : r)));
  }, []);

  // Rooms CRUD
  const addRoom = useCallback((room: Omit<Room, "id">) => {
    const id = rid++;
    setRooms((rs) => [...rs, { ...room, id }]);
    return id;
  }, []);

  const bulkAddRooms = useCallback((start: number, end: number, type: Room["type"]) => {
    if (end < start) return;
    const newRooms: Room[] = [];
    for (let n = start; n <= end; n++) {
      newRooms.push({ id: rid++, number: String(n), type, status: "clean", guest: null, checkoutAt: null, image_url: null });
    }
    setRooms((rs) => [...rs, ...newRooms]);
  }, []);

  const updateRoom = useCallback((roomId: number, data: Partial<Omit<Room, "id">>) => {
    setRooms((rs) => rs.map((r) => (r.id === roomId ? { ...r, ...data } : r)));
  }, []);

  const deleteRoom = useCallback((roomId: number) => {
    setRooms((rs) => rs.filter((r) => r.id !== roomId));
  }, []);

  // Orders
  const addOrder = useCallback((o: Omit<Order, "id">) => {
    const id = oid++;
    setOrders((os) => [...os, { ...o, id }]);
    return id;
  }, []);

  const addOrderLine = useCallback((orderId: number, line: Omit<OrderLine, "id">) => {
    const id = lid++;
    setOrders((os) => os.map((o) => (o.id === orderId ? { ...o, lines: [...o.lines, { ...line, id }] } : o)));
    return id;
  }, []);

  const setOrderLineStatus = useCallback((orderId: number, lineId: number, status: FireStatus) => {
    const ts = nowIso();
    setOrders((os) =>
      os.map((o) =>
        o.id !== orderId
          ? o
          : {
              ...o,
              lines: o.lines.map((l) =>
                l.id !== lineId
                  ? l
                  : {
                      ...l,
                      fire_status: status,
                      fired_at: status === "commanded" ? ts : l.fired_at,
                      prepared_at: status === "preparing" ? ts : l.prepared_at,
                      delivered_at: status === "delivered" ? ts : l.delivered_at,
                    }
              ),
            }
      )
    );
  }, []);

  const closeOrder = useCallback((orderId: number) => {
    setOrders((os) => os.map((o) => (o.id === orderId ? { ...o, status: "closed", closed_at: nowIso() } : o)));
  }, []);

  // Tabs
  const addTab = useCallback((t: Omit<Tab, "id">) => {
    const id = tid++;
    setTabs((ts) => [...ts, { ...t, id }]);
    return id;
  }, []);

  const payTab = useCallback((tabId: number, amount: number) => {
    setTabs((ts) =>
      ts.map((t) => {
        if (t.id !== tabId) return t;
        const balance = Math.max(0, t.balance - amount);
        const status: TabStatus = balance === 0 ? "paid" : t.status === "paid" ? "paid" : "open";
        return { ...t, balance, status };
      })
    );
  }, []);

  const markTabUnpaid = useCallback((tabId: number) => {
    setTabs((ts) => ts.map((t) => (t.id === tabId ? { ...t, status: t.balance > 0 ? "unpaid" : "paid" } : t)));
  }, []);

  // Spa
  const setAppointmentStatus = useCallback((id: number, status: AppointmentStatus) => {
    setAppointments((as) => as.map((a) => (a.id === id ? { ...a, status } : a)));
  }, []);

  // Inventory
  const stockMove = useCallback((m: Omit<StockMovement, "id" | "created_at">) => {
    const id = smid++;
    setStocks((ss) =>
      ss.map((s) => {
        if (s.store_id !== m.store_id || s.item_id !== m.item_id) return s;
        let qty = s.qty_on_hand;
        if (m.type === "IN") qty += m.qty;
        else if (m.type === "OUT" || m.type === "CONSUME") qty = Math.max(0, qty - m.qty);
        else if (m.type === "ADJUST") qty = Math.max(0, qty + m.qty);
        return { ...s, qty_on_hand: qty };
      })
    );
    setStockMovements((ms) => [...ms, { ...m, id, created_at: nowIso() }]);
  }, []);

  const addItem = useCallback((item: Omit<Item, "id">) => {
    const id = itid++;
    setItems((items) => [...items, { ...item, id }]);
    return id;
  }, []);

  const updateItem = useCallback((itemId: number, data: Partial<Omit<Item, "id">>) => {
    setItems((items) => items.map((it) => (it.id === itemId ? { ...it, ...data } : it)));
  }, []);

  const deleteItem = useCallback((itemId: number) => {
    setItems((items) => items.filter((it) => it.id !== itemId));
    setStocks((stocks) => stocks.filter((s) => s.item_id !== itemId));
  }, []);

  const addStock = useCallback((stock: Omit<Stock, "id">) => {
    const id = stid++;
    setStocks((stocks) => [...stocks, { ...stock, id }]);
    return id;
  }, []);

  const updateStock = useCallback((stockId: number, data: Partial<Omit<Stock, "id">>) => {
    setStocks((stocks) => stocks.map((s) => (s.id === stockId ? { ...s, ...data } : s)));
  }, []);

  // Cash
  const openCashSession = useCallback((dept: Department, opening_float: number, opened_by: string) => {
    const id = csid++;
    setCashSessions((cs) => [
      ...cs,
      { id, department_id: dept, opened_by, opened_at: nowIso(), opening_float, status: "open", closed_by: null, closed_at: null, closing_amount: null },
    ]);
    return id;
  }, []);

  const closeCashSession = useCallback((sessionId: number, closing_amount: number, closed_by: string) => {
    setCashSessions((cs) =>
      cs.map((c) => (c.id === sessionId ? { ...c, status: "closed", closing_amount, closed_by, closed_at: nowIso() } : c))
    );
  }, []);

  const value: AppState = useMemo(
    () => ({
      rooms,
      orders,
      tabs,
      appointments,
      stores,
      items,
      stocks,
      stock_movements,
      cash_sessions,
      setRoomStatus,
      checkIn,
      checkOut,
      addRoom,
      bulkAddRooms,
      updateRoom,
      deleteRoom,
      addOrder,
      addOrderLine,
      setOrderLineStatus,
      closeOrder,
      addTab,
      payTab,
      markTabUnpaid,
      setAppointmentStatus,
      stockMove,
      addItem,
      updateItem,
      deleteItem,
      addStock,
      updateStock,
      openCashSession,
      closeCashSession,
    }),
    [
      rooms,
      orders,
      tabs,
      appointments,
      stores,
      items,
      stocks,
      stock_movements,
      cash_sessions,
      setRoomStatus,
      checkIn,
      checkOut,
      addRoom,
      bulkAddRooms,
      updateRoom,
      deleteRoom,
      addOrder,
      addOrderLine,
      setOrderLineStatus,
      closeOrder,
      addTab,
      payTab,
      markTabUnpaid,
      setAppointmentStatus,
      stockMove,
      addItem,
      updateItem,
      deleteItem,
      addStock,
      updateStock,
      openCashSession,
      closeCashSession,
    ]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
