import { onCall } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { FBServices, services } from "./base.js";
import { Group } from "./group.js";
export class Invitation {
    id;
    data;
    ref;
    constructor(id, data) {
        this.id = id;
        this.data = data;
        this.ref = services.db.collection("invitations").doc(id);
    }
    static async create(request, transaction) {
        const data = await this.getSnapshot(request.id, transaction);
        return new Invitation(request.id, data);
    }
    static async rejectedCreate(request, transaction) {
        const data = await this.getSnapshot(request.id, transaction);
        return new Invitation(request.id, data);
    }
    static async getSnapshot(id, transaction) {
        const ref = services.db.collection("invitations").doc(id);
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) {
            throw FBServices.errors.notFound();
        }
        return snapshot.data();
    }
}
export const acceptInvitation = onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw FBServices.errors.unauthenticated();
    }
    // check data is present and the signed in user is accepting the invitation
    const invitationRequest = request.data;
    if (!invitationRequest || !invitationRequest.user || !invitationRequest.id || invitationRequest.user.id !== uid) {
        throw FBServices.errors.invalidArgument();
    }
    await services.db.runTransaction(async (transaction) => {
        const invitation = await Invitation.create(invitationRequest, transaction);
        const group = new Group(invitation.data.groupId);
        await group.get(transaction);
        const profileRef = services.db.collection("user_profiles").doc(uid);
        const profileDoc = await transaction.get(profileRef);
        const baseProfile = {
            id: uid,
            name: invitationRequest.user.name,
            displayName: invitationRequest.user.displayName,
            email: request.auth?.token.email ?? invitationRequest.user.email,
            defaultGroup: group.gid,
            groups: [group.gid],
        };
        if (!profileDoc.exists) {
            transaction.set(profileRef, baseProfile);
        }
        else {
            const existing = profileDoc.data();
            const updatedProfile = {
                ...existing,
                name: baseProfile.name,
                displayName: baseProfile.displayName,
                email: baseProfile.email,
                defaultGroup: existing.defaultGroup ?? group.gid,
                groups: Array.from(new Set([...(existing.groups ?? []), group.gid]))
            };
            transaction.set(profileRef, updatedProfile, { merge: true });
        }
        group.addUser(baseProfile, invitation, transaction);
        transaction.delete(invitation.ref);
    });
});
export const rejectInvitation = onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw FBServices.errors.unauthenticated();
    }
    const requestData = request.data;
    if (!requestData?.id) {
        throw FBServices.errors.notFound();
    }
    await services.db.runTransaction(async (transaction) => {
        let invitation = await Invitation.rejectedCreate(requestData, transaction);
        if (!invitation.data.groupId) {
            throw FBServices.errors.notFound();
        }
        transaction.delete(invitation.ref);
        const group = new Group(invitation.data.groupId);
        transaction.update(group.ref, {
            invitations: FieldValue.arrayRemove(invitation.id)
        });
    });
});
