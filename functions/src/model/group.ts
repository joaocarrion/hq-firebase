import { FieldValue, Transaction } from "firebase-admin/firestore";
import { FBServices, services } from "./base.js";
import { UserProfileData } from "./user.js";
import { onCall } from "firebase-functions/v2/https";
import { Invitation } from "./invitation.js";

export interface GroupUserProfile {
  id: string;
  email: string;
  displayName: string;
}

export interface GroupData {
  id: string;
  name: string;
  description: string;
  profiles: GroupUserProfile[];
  admins: string[];
  users: string[];
}

export class Group {
  gid: string;
  ref: FirebaseFirestore.DocumentReference;
  data: GroupData | undefined;

  constructor(gid: string) {
    this.gid = gid;
    this.ref = services.db.collection("groups").doc(gid);
  }

  async get(transaction: FirebaseFirestore.Transaction | undefined) {
    if (transaction) {
      const snapshot = await transaction.get(this.ref);
      if (!snapshot.exists) throw FBServices.errors.notFound();
      this.data = snapshot.data() as GroupData;
    } else {
      const snapshot = await this.ref.get()
      if (!snapshot.exists) throw FBServices.errors.notFound();
      this.data = snapshot.data() as GroupData;
    }
  }

  addUser(profile: UserProfileData, invitation: Invitation, transaction: FirebaseFirestore.Transaction) {
    transaction.update(this.ref, {
      users: FieldValue.arrayUnion(profile.id),
      profiles: FieldValue.arrayUnion({
        id: profile.id,
        email: profile.email,
        displayName: profile.displayName,
        joinedAt: FieldValue.serverTimestamp(),
        invitedBy: invitation.data.invitedBy
      }),
      invitations: FieldValue.arrayRemove(invitation.id)
    });
  }
  
  removeUser(uid: string, transaction: Transaction) {
    if (!this.data?.profiles) throw FBServices.errors.notFound();
    this.data.profiles = this.data.profiles.filter(p => p.id !== uid);
    this.data.users = this.data.users.filter(id => id !== uid);
    this.data.admins = this.data.admins.filter(id => id !== uid);

    transaction.update(this.ref, {
      users: FieldValue.arrayRemove(uid),
      admins: FieldValue.arrayRemove(uid),
      profiles: this.data.profiles
    })
  }

  isEmpty() {
    return this.data != undefined && this.data.users.length == 0 && this.data.admins.length == 0;
  }
}

export const createInvitation = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw FBServices.errors.unauthenticated();
  }

  const { gid, name, description, invitedBy } = request.data;

  if (!gid || !name || !description || !invitedBy) {
    throw FBServices.errors.invalidArgument();
  }

  const id = await services.db.runTransaction(async (transaction) => {
    const group = new Group(gid);
    await group.get(transaction);

    if (!group.data?.admins.includes(uid)) {
      throw FBServices.errors.permissionDenied();
    }

    const invitationData = {
      groupId: gid,
      name,
      description,
      invitedBy,
      state: "undefined",
      createdAt: FieldValue.serverTimestamp()
    };

    const invitationRef = services.db.collection("invitations").doc();
    transaction.set(invitationRef, invitationData);
    transaction.update(group.ref, {
      invitations: FieldValue.arrayUnion(invitationRef.id)
    })

    return invitationRef.id;
  });

  return id;
});
