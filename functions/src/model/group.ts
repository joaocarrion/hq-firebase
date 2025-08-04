import { FieldValue, Transaction, Timestamp } from "firebase-admin/firestore";
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
  lastUpdated: Timestamp | FieldValue | null
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
        joinedAt: Timestamp.now(),
        invitedBy: invitation.data.invitedBy
      }),
      invitations: FieldValue.arrayRemove(invitation.id),
      lastUpdated: FieldValue.serverTimestamp(),
    });
  }
  
  removeUser(uid: string, transaction: Transaction) {
    if (!this.data?.profiles) throw FBServices.errors.notFound();
    this.data.profiles = this.data.profiles.filter(p => p.id !== uid);
    this.data.users = this.data.users.filter(id => id !== uid);
    this.data.admins = this.data.admins.filter(id => id !== uid);

    // if an admin leaves a group without an admin, promete the first user to admin
    if (this.data.admins.length == 0 && this.data.users.length > 0) {
      this.data.admins = [this.data.users[0]];
    }

    transaction.update(this.ref, {
      users: FieldValue.arrayRemove(uid),
      admins: this.data.admins,
      profiles: this.data.profiles,
      lastUpdated: FieldValue.serverTimestamp(),
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
      invitations: FieldValue.arrayUnion(invitationRef.id),
      lastUpdated: FieldValue.serverTimestamp(),
    })

    return invitationRef.id;
  });

  return id;
});
