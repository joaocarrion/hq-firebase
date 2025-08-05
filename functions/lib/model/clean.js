import { onSchedule } from "firebase-functions/v2/scheduler";
import { services } from "./base.js";
import { Timestamp } from "firebase-admin/firestore";

const db = services.db;
export const cleanExpired = onSchedule(
  {
    schedule: "0 3 * * *",
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1",
  },
  async (event) => {
    // Delete removed groups
    const deleteCutoffDate = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

    try {
      const snapshot = await db.collection("groupsForRemoval").where("date", "<=", deleteCutoffDate).select().get();

      for (const group of snapshot.docs) {
        const groupRef = db.collection("groups").doc(group.id);
        await db.recursiveDelete(groupRef);
      }

      const batch = db.batch();

      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      console.log(`Deleted ${snapshot.docs.length} groups scheduled for removal`);
    } catch (error) {
      console.error("Failed to remove deleted groups", error);
    }

    // Remove delete users
    try {
      const batch = db.batch();

      const usersForRemoval = await db.collection("deletedUsers").where("lastUpdated", "<=", deleteCutoffDate).select().get();

      usersForRemoval.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      console.log(`Deleted ${usersForRemoval.docs.length} users scheduled for removal`);
    } catch (error) {
      console.error("Failed to remove deleted users", error);
    }

    try {
      const batch = db.batch();

      const invitationCutoff = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
      const invitations = await db.collection("invitations").where("createdAt", "<=", invitationCutoff).select("groupId").get();

      invitations.forEach((doc) => {
        batch.delete(doc.ref);
        const gid = doc.data()["groupId"];
        if (gid) {
          const ref = db.collection("groups").doc(gid).collection("invitations").doc(doc.id);
          batch.delete(ref);
        }
      });

      await batch.commit();

      console.log(`Deleted ${invitations.docs.length} expired invitations`);
    } catch (error) {
      console.error("Failed to clean up expired invitations", error);
    }
  }
);
