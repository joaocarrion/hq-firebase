// INITIALIZE
const admin = require('firebase-admin');
admin.initializeApp();

const firestore = admin.firestore();
const functions = require('firebase-functions');

exports.deleteInvitation = functions.https.onCall(async (data, context) => {
	if (!context.auth) {
		throw new functions.https.HttpsError('unauthenticated');
	}

	if (!data.email || !data.group) {
		throw new functions.https.HttpsError('invalid-argument');
	}

	let invitationRef = firestore.collection('invitations')
		.where('email', '==', data.email)
		.where('group', '==', data.group);
	let invitations = await invitationRef.get();
	if (invitations.empty) {
		throw new functions.https.HttpsError('not-found');
	}

	let groupRef = firestore.collection('groups').doc(data.group);
	let group = await groupRef.get();
	if (!group.exists) {
		throw new functions.https.HttpsError('not-found');
	}

	if (!group.data().admins.includes(context.auth.uid)) {
		throw new functions.https.HttpsError('permission-denied');
	}

	let batch = firestore.batch();
	invitations.forEach(doc => {
		batch.delete(doc.ref);
	});

	batch.update(groupRef, {
		invitations: admin.firestore.FieldValue.arrayRemove(data.email)
	});

	await batch.commit();
});

exports.acceptInvitation = functions.https.onCall(async (data, context) => {
	// console.log("Accept invitation for: ", context.auth.token.email);
	if (!context.auth || !context.auth.token.email) {
		throw new functions.https.HttpsError('unauthenticated');
	}

	if (!data.invitation) {
		throw new functions.https.HttpsError('invalid-argument');
	}

	let invitationRef = firestore.collection('invitations').doc(data.invitation);
	let doc = await invitationRef.get();
	if (!doc.exists) {
		throw new functions.https.HttpsError('not-found');
	}

	let invitation = doc.data();
	if (invitation.email != context.auth.token.email) {
		throw new functions.https.HttpsError('permission-denied');
	}

	let groupRef = firestore.collection('groups').doc(invitation.group);
	let group = await groupRef.get();
	if (!group.exists) {
		throw new functions.https.HttpsError('not-found');
	}

	let userProfileRef = firestore.collection('user_profiles').doc(context.auth.uid);
	let userProfile = await userProfileRef.get();
	if (!userProfile.exists || userProfile.data().email != context.auth.token.email) {
		throw new functions.https.HttpsError('not-found');
	}

	let isHouseHold = invitation.isHouseHold ?? true;
	let profile = {
		id: context.auth.uid,
		email: context.auth.token.email,
		displayName: userProfile.data().displayName
	};

	let batch = firestore.batch();
	batch.delete(invitationRef);
	batch.update(groupRef, {
		users: admin.firestore.FieldValue.arrayUnion(context.auth.uid),
		invitations: admin.firestore.FieldValue.arrayRemove(context.auth.token.email),
		profiles: admin.firestore.FieldValue.arrayUnion(profile)
	});

	let profileUpdate = {
		groups: admin.firestore.FieldValue.arrayUnion(group.data().id)
	};

	if (isHouseHold) {
		profileUpdate['defaultGroup'] = group.data().id;
	}

	batch.update(userProfileRef, profileUpdate);
	await batch.commit();
});

exports.rejectInvitation = functions.https.onCall(async (data, context) => {
	if (!context.auth || !context.auth.token.email) {
		throw new functions.https.HttpsError('unauthenticated');
	}

	if (!data.invitation) {
		throw new functions.https.HttpsError('invalid-argument');
	}

	let invitationRef = firestore.collection('invitations').doc(data.invitation);
	let invitation = await invitationRef.get();
	if (!invitation.exists) {
		throw new functions.https.HttpsError('not-found');
	}

	if (invitation.data().email != context.auth.token.email) {
		throw new functions.https.HttpsError('permission-denied');
	}

	let groupRef = firestore.collection('groups').doc(invitation.data().group);
	
	let batch = firestore.batch();
	batch.delete(invitationRef);
	batch.update(groupRef, {
		invitations: admin.firestore.FieldValue.arrayRemove(context.auth.token.email)
	});

	await batch.commit();
});
