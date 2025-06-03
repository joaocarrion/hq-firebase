import { services } from "../model/base.js";
import { Timestamp } from "firebase-admin/firestore";
const db = services.db;
const now = Timestamp.now();
const groups = ["group1", "group2", "group3"];
const sampleItems = [
    { id: "item1", product: "prod_milk", listUnit: 6, quantity: 2 },
    { id: "item2", product: "prod_banana", listUnit: 6, quantity: 6 },
    { id: "item3", product: "prod_detergent", listUnit: 6, quantity: 1 },
    { id: "item4", product: "prod_chips", listUnit: 6, quantity: 3 },
    { id: "item5", product: "prod_juice", listUnit: 6, quantity: 2 },
];
export const seedGroupLists = async function () {
    const batch = db.batch();
    for (const groupId of groups) {
        const listRef = db.collection("groups").doc(groupId).collection("lists").doc("household.pendencies");
        batch.set(listRef, {
            id: "household.pendencies",
            name: "Pendencias",
            type: "ShoppingList",
            created: now,
            lastUpdated: now,
        });
        const productsRef = listRef.collection("products");
        for (const item of sampleItems) {
            const docRef = productsRef.doc(item.id);
            batch.set(docRef, item);
        }
    }
    await batch.commit();
    console.log("Seeded group lists and list items.");
};
export const seedPurchases = async function () {
    const batch = db.batch();
    for (const groupId of groups) {
        const purchasesRef = db.collection("groups").doc(groupId).collection("purchases");
        const purchases = [
            {
                accessKey: `AK-${groupId}-001`,
                number: "123",
                series: "A1",
                date: now,
                products: [
                    {
                        product: "prod_milk",
                        quantity: 2,
                        unitPrice: 450,
                        totalPrice: 900,
                    },
                    {
                        product: "prod_cookie",
                        quantity: 1,
                        unitPrice: 350,
                        totalPrice: 350,
                    },
                ],
                totalAmount: 1250,
                payments: [{ method: "credit", amount: 1250 }],
                cpf: "12345678900",
                taxes: [80, 45],
                storeId: "12345678000199",
            },
            {
                accessKey: `AK-${groupId}-002`,
                number: "124",
                series: "A2",
                date: now,
                products: [
                    {
                        product: "prod_chips",
                        quantity: 3,
                        unitPrice: 300,
                        totalPrice: 900,
                        totalDiscount: 100,
                    },
                ],
                totalAmount: 800,
                payments: [{ method: "debit", amount: 800 }],
                cpf: "12345678900",
                taxes: [60],
                storeId: "98765432000155",
            },
        ];
        for (const purchase of purchases) {
            const docRef = purchasesRef.doc();
            batch.set(docRef, purchase);
        }
    }
    await batch.commit();
    console.log("Seeded purchases for each group.");
};
