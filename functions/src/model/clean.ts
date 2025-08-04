// import { onSchedule } from "firebase-functions/v2/scheduler";
// import { services } from "./base.js";
// import { Timestamp } from "firebase-admin/firestore";

// const db = services.db;

// export const cleanExpired = onSchedule({
//     schedule: "0 3 * * *",
//     timeZone: "America/Sao_Paulo",
//     region: "southamerica-east1"
// }, async (event) => {
//     const batch = db.batch();

//     const groupCutoff = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
//     const snapshot = await db
//         .collection("groupsForRemoval")
//         .where("date", "<=", groupCutoff)
//         .select()
//         .get();
    
//     snapshot.forEach(doc => {
//         const ref = doc.ref;
//         const groupRef = db.collection("groups").doc(doc.id);

//         batch.delete(ref);
//         batch.
//     });
    
    

// })