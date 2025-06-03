import { Timestamp } from "firebase-admin/firestore";
import { services } from "../model/base.js";
const db = services.db;
function formatCNPJ(cnpj) {
    return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12, 14)}`;
}
export const seedProductsAndCategories = async function () {
    const batch = db.batch();
    const now = Timestamp.now();
    // Root categories
    const categories = [
        { id: "cat_food", name: "Food", parentID: null },
        { id: "cat_cleaning", name: "Cleaning", parentID: null },
        { id: "cat_beverages", name: "Beverages", parentID: null },
        { id: "cat_snacks", name: "Snacks", parentID: "cat_food" },
        { id: "cat_softdrinks", name: "Soft Drinks", parentID: "cat_beverages" },
    ];
    const ref = db.collection("public/latest/products");
    for (const cat of categories) {
        const docRef = ref.doc(cat.id);
        batch.set(docRef, {
            id: cat.id,
            name: cat.name,
            description: `${cat.name} category`,
            created: now,
            lastUpdated: now,
            parentID: cat.parentID,
            type: "category",
        });
    }
    // Sample products
    const products = [
        { id: "prod_apple", name: "Apple", category: "cat_food" },
        { id: "prod_banana", name: "Banana", category: "cat_food" },
        { id: "prod_chips", name: "Potato Chips", category: "cat_snacks" },
        { id: "prod_cola", name: "Cola", category: "cat_softdrinks" },
        { id: "prod_juice", name: "Orange Juice", category: "cat_beverages" },
        { id: "prod_milk", name: "Milk", category: "cat_beverages" },
        { id: "prod_detergent", name: "Detergent", category: "cat_cleaning" },
        { id: "prod_soap", name: "Bar Soap", category: "cat_cleaning" },
        { id: "prod_water", name: "Mineral Water", category: "cat_softdrinks" },
        { id: "prod_cookie", name: "Chocolate Cookie", category: "cat_snacks" },
    ];
    for (const prod of products) {
        const docRef = ref.doc(prod.id);
        batch.set(docRef, {
            id: prod.id,
            name: prod.name,
            description: `${prod.name} product`,
            created: now,
            lastUpdated: now,
            parentID: prod.category,
            type: "product",
        });
    }
    // Sample stores
    const stores = [
        {
            id: "12345678000199",
            name: "Supermercado Central Ltda",
            nickname: "Central",
            address: "Av. Brasil, 1234 - Centro, São Paulo - SP",
        },
        {
            id: "98765432000155",
            name: "Hipermercado do Bairro EIRELI",
            nickname: "Hiper Bairro",
            address: "Rua das Flores, 567 - Bairro Novo, Rio de Janeiro - RJ",
        },
        {
            id: "45678912000177",
            name: "Atacadão Econômico ME",
            nickname: "Econômico",
            address: "Rod. BR-101, Km 22 - Industrial, Curitiba - PR",
        },
    ];
    const storesRef = db.collection("public/latest/stores");
    for (const store of stores) {
        const docRef = storesRef.doc(store.id);
        batch.set(docRef, {
            id: store.id,
            name: store.name,
            nickname: store.nickname,
            address: store.address,
            cnpj: formatCNPJ(store.id),
        });
    }
    await batch.commit();
    console.log("Seeded products and categories.");
};
