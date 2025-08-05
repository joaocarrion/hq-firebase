import { onCall } from "firebase-functions/v2/https";
import { Transaction, Timestamp, DocumentReference, FieldValue } from "firebase-admin/firestore";

import { FBServices, services } from "./base.js";
import { Group } from "./group.js";
import { UserProfileData } from "./user.js";

interface RejectInvitationData {
  id: string;
}

interface InvitationRequest {
  id: string;
  user: UserProfileData
}

export interface InvitationData {
  groupId: string;
  name: string;
  description: string;
  invitedBy: string
  state?: string;
  createdAt?: Timestamp;
}

export class Invitation {
  id: string;
  data: InvitationData;
  ref: DocumentReference;

  constructor(id: string, data: InvitationData) {
    this.id = id;
    this.data = data;
    this.ref = services.db.collection("invitations").doc(id);
  }

  static async create(request: InvitationRequest, transaction: Transaction): Promise<Invitation> {
    const data = await this.getSnapshot(request.id, transaction);
    return new Invitation(request.id, data);
  }

  static async rejectedCreate(request: RejectInvitationData, transaction: Transaction): Promise<Invitation> {
    const data = await this.getSnapshot(request.id, transaction);
    return new Invitation(request.id, data)
  }

  static async getSnapshot(id: string, transaction: Transaction): Promise<InvitationData> {
    const ref = services.db.collection("invitations").doc(id);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) {
      throw FBServices.errors.notFound();
    }

    return snapshot.data() as InvitationData;
  }
}

export const acceptInvitation = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw FBServices.errors.unauthenticated();
  }

  // check data is present and the signed in user is accepting the invitation
  const invitationRequest = request.data as InvitationRequest;
  if (!invitationRequest || !invitationRequest.user || !invitationRequest.id || invitationRequest.user.id !== uid) {
    throw FBServices.errors.invalidArgument();
  }

  await services.db.runTransaction(async (transaction) => {
    const invitation = await Invitation.create(invitationRequest, transaction);
    const group = new Group(invitation.data.groupId);
    await group.get(transaction);

    const profileRef = services.db.collection("user_profiles").doc(uid);
    const profileDoc = await transaction.get(profileRef);

    const baseProfile: UserProfileData = {
      id: uid,
      name: invitationRequest.user.name,
      displayName: invitationRequest.user.displayName,
      email: request.auth?.token.email ?? invitationRequest.user.email,
      defaultGroup: group.gid,
      groups: [group.gid],
      lastUpdated: FieldValue.serverTimestamp()
    };

    if (!profileDoc.exists) {
      // console.log("Creating user profile with lastUpdated: FieldValue.serverTimestamp()");
      transaction.set(profileRef, baseProfile);
    } else {
      const existing = profileDoc.data() as UserProfileData;
      const updatedProfile: UserProfileData = {
        ...existing,
        name: baseProfile.name,
        displayName: baseProfile.displayName,
        email: baseProfile.email,
        defaultGroup: existing.defaultGroup ?? group.gid,
        groups: Array.from(new Set([...(existing.groups ?? []), group.gid])),
        lastUpdated: FieldValue.serverTimestamp()
      };

      // console.log("Setting user profile with lastUpdated: FieldValue.serverTimestamp()");
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

  const requestData = request.data as RejectInvitationData;
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
