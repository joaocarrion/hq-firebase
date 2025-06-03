import { getAuth } from "firebase-admin/auth";
import { services } from "../model/base.js";
import { seedProductsAndCategories } from "./seed_products.js";
import { seedGroupLists, seedPurchases } from "./seed_groups.js";
export const seedBase = async function () {
    // create a few users
    const auth = getAuth();
    const batch = services.db.batch();
    const usersCollection = services.db.collection("user_profiles");
    const groupsCollection = services.db.collection("groups");
    for (const user of users) {
        const record = await auth.createUser(user);
        if (!record) {
            console.error("Failed to create user");
        }
        else {
            console.log("created: ", JSON.stringify(record));
        }
        const group1 = "group1";
        const group2 = "group2";
        const group3 = "group3";
        let groups;
        let defaultGroup;
        if (user.uid === "user1") {
            groups = [group1];
            defaultGroup = group1;
        }
        else if (user.uid === "user2") {
            groups = [group1, group2];
            defaultGroup = group2;
        }
        else {
            groups = [group2, group3];
            defaultGroup = group3;
        }
        const profile = {
            id: user.uid,
            name: user.displayName,
            email: user.email,
            displayName: user.displayName,
            defaultGroup: defaultGroup,
            groups: groups
        };
        const ref = usersCollection.doc(profile.id);
        batch.set(ref, profile);
    }
    for (const group of groups) {
        const ref = groupsCollection.doc(group.id);
        batch.set(ref, group);
    }
    await batch.commit();
    // create some products, categories and stores
    await seedProductsAndCategories();
    await seedGroupLists();
    await seedPurchases();
    console.log("Has seeded the database");
    for (const user of users) {
        const token = await auth.createCustomToken(user.uid);
        const logToken = {
            user: user.uid,
            token: token
        };
        console.log(JSON.stringify(logToken));
    }
};
const users = [
    {
        uid: "user1",
        email: "test1@example.com",
        emailVerified: true,
        displayName: "test user 1",
        password: "password123"
    },
    {
        uid: "user2",
        email: "test2@example.com",
        emailVerified: true,
        displayName: "test user 2",
        password: "password123"
    },
    {
        uid: "user3",
        email: "test3@example.com",
        emailVerified: true,
        displayName: "test user 3",
        password: "password123"
    },
];
/**
 * export interface GroupUserProfile {
  id: string;
  email: string;
  displayName: string;
}

export interface GroupData {
  id: string;
  description: string;
  profiles: GroupUserProfile[];
  admins: string[];
  users: string[];
}

 */
const groups = [
    {
        id: "group1",
        name: "Meu Lar 1",
        description: "Grupo 1 do meu lar",
        admins: ["user1"],
        users: ["user1", "user2"],
        profiles: [
            { id: "user1", email: "test1@example.com", displayName: "User 1" },
            { id: "user2", email: "test2@example.com", displayName: "User 2" }
        ]
    },
    {
        id: "group2",
        name: "Meu Lar 2",
        description: "Grupo 2 do meu lar",
        admins: ["user2"],
        users: ["user3", "user2"],
        profiles: [
            { id: "user3", email: "test3@example.com", displayName: "User 3" },
            { id: "user2", email: "test2@example.com", displayName: "User 2" }
        ]
    },
    {
        id: "group3",
        name: "Meu Lar 3",
        description: "Grupo 3 do meu lar",
        admins: ["user3"],
        users: ["user3"],
        profiles: [
            { id: "user3", email: "test3@example.com", displayName: "User 3" },
        ]
    }
];
