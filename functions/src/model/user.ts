import { onCall } from "firebase-functions/v2/https";
import { FBServices, services } from "./base.js";
import { Group } from "./group.js";

const userProfiles = services.db.collection("user_profiles");

export interface UserProfileData {
    id: string;
    name: string;
    email: string;
    displayName: string;
    defaultGroup?: string | null;
    groups?: string[] | null;
}
  
interface RemoveUserData {
    uid: string;
    gid: string;
}

export const removeUser = onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw FBServices.errors.unauthenticated();
    }

    const data = request.data as RemoveUserData;
    if (!data.gid || !data.uid) {
        throw FBServices.errors.invalidArgument();
    }

    await services.db.runTransaction(async (transaction) => {
        const group = new Group(data.gid);
        await group.get(transaction);

        console.log(group.data?.admins);
        if (!group.data?.admins.includes(uid)) {
            throw FBServices.errors.permissionDenied();
        }

        if (!group.data?.users.includes(data.uid)) {
            throw FBServices.errors.notFound();
        }

        const profileRef = userProfiles.doc(data.uid);
        const snapshot = await transaction.get(profileRef);
        if (!snapshot.exists) {
            throw FBServices.errors.notFound();
        }
        const userData = snapshot.data() as UserProfileData;
        if (!userData) {
            throw FBServices.errors.notFound();
        }

        await group.removeUser(data.uid, transaction);
        const groups = userData.groups?.filter(g => g !== group.gid);
        
        await transaction.update(profileRef, {
            groups: groups,
            defaultGroup: userData.defaultGroup === data.gid
                ? (groups && groups.length > 0 ? groups[0] : null)
                : userData.defaultGroup
        });
    });
});

export const leaveGroup = onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw FBServices.errors.unauthenticated();
    }

    const gid = request.data?.gid;
    if (!gid) {
        throw FBServices.errors.invalidArgument();
    }

    await services.db.runTransaction(async (transaction) => {
        const group = new Group(gid);
        await group.get(transaction);

        if (!group.data?.users.includes(uid)) {
            throw FBServices.errors.notFound();
        }

        const profileRef = userProfiles.doc(uid);
        const userSnap = await transaction.get(profileRef);
        if (!userSnap.exists) {
            throw FBServices.errors.notFound();
        }

        const userData = userSnap.data() as UserProfileData;
        const remainingGroups = (userData.groups ?? []).filter(g => g !== gid);

        await group.removeUser(uid, transaction);

        const first = remainingGroups.length > 0 ? remainingGroups[0] : null;
        transaction.update(profileRef, {
            groups: remainingGroups,
            defaultGroup: first
        });
    });
});