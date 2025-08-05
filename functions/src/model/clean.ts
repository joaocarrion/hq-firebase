import { onSchedule } from "firebase-functions/v2/scheduler";
import { services } from "./base.js";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

const db = services.db;

export const cleanExpired = onSchedule({
    schedule: "0 3 * * *",
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1"
}, async () => {
    const now = Date.now();

    try {
        // 1. Delete expired group markers
        const groupCutoff = Timestamp.fromDate(new Date(now - 7 * 24 * 60 * 60 * 1000));
        const groupsForRemovalSnapshot = await db
            .collection("groupsForRemoval")
            .where("date", "<=", groupCutoff)
            .select()
            .get();

        let groupsRemovedCount = 0;
        for (const doc of groupsForRemovalSnapshot.docs) {
            const groupId = doc.id;
            const groupRef = db.collection("groups").doc(groupId);
            await db.recursiveDelete(groupRef);
            await doc.ref.delete();
            groupsRemovedCount++;
        }
        console.log(`Cleaned ${groupsRemovedCount} expired group markers.`);
    } catch (error) {
        console.error('Failed to clean up groups', error);
    }

    try {
        // 2. Delete expired deleted users
        const deletedUsersCutoff = Timestamp.fromDate(new Date(now - 7 * 24 * 60 * 60 * 1000));
        const deletedUsersSnapshot = await db
            .collection("deletedUsers")
            .where("lastUpdated", "<=", deletedUsersCutoff)
            .select()
            .get();

        const batch = db.batch();
        deletedUsersSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Cleaned ${deletedUsersSnapshot.size} expired deleted users.`);
    } catch (error) {
        console.error('Failed to clean up removed users', error);
    }

    try {
        // 3. Delete expired invitations
        const invitationsCutoff = Timestamp.fromDate(new Date(now - 1 * 24 * 60 * 60 * 1000));
        const invitationsSnapshot = await db
            .collection("invitations")
            .where("createdAt", "<=", invitationsCutoff)
            .select("groupId")
            .get();

        let invitationsRemovedCount = 0;
        for (const doc of invitationsSnapshot.docs) {
            const invitationId = doc.id;
            const groupId = doc.get("groupId");
            if (groupId) {
                const groupRef = db.collection("groups").doc(groupId);
                await groupRef.update({
                    invitations: FieldValue.arrayRemove(invitationId)
                });
            }
            await doc.ref.delete();
            invitationsRemovedCount++;
        }
        console.log(`Cleaned ${invitationsRemovedCount} expired invitations.`);
    } catch (error) {
        console.error('Failed to remove expired invitations', error);
    }
});