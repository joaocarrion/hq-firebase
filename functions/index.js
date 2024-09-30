// INITIALIZE
const admin = require('firebase-admin');
admin.initializeApp();

const firestore = admin.firestore();
const functions = require('firebase-functions');

exports.acceptInvitation = functions.https.onCall(async (data, context) => {
	if (!context.auth) {
		throw new functions.https.HttpsError('unauthenticated');
	}

	let id = data.id
	let userInfo = data.user
	if (!id || !userInfo) {
		throw new functions.https.HttpsError('invalid-argument');
	}

	let invitation = await firestore.collection('invitations').doc(id).get();
	if (!invitation.exists) {
		throw new functions.https.HttpsError('not-found');
	}

	let groupRef = firestore.collection('groups').doc(invitation.data().groupId);
	let group = await groupRef.get();
	if (!group.exists) {
		throw new functions.https.HttpsError('not-found');
	}

	let userProfileRef = firestore.collection('user_profiles').doc(context.auth.uid);
	let userProfile = await userProfileRef.get();

	let batch = firestore.batch();
	if (!userProfile.exists) {
		let profileInfo = {
			id: userInfo.id,
			name: userInfo.name,
			email: context.auth.token.email,
			displayName: userInfo.displayName,
			defaultGroup: invitation.data().groupId,
			groups: [invitation.data().groupId]
		}

		batch.set(userProfileRef, profileInfo);
	} else {
		batch.update(userProfileRef, {
			groups: admin.firestore.FieldValue.arrayUnion(invitation.data().groupId),
			defaultGroup: invitation.data().groupId
		});
	}

	batch.update(groupRef, {
		users: admin.firestore.FieldValue.arrayUnion(context.auth.uid),
		invitations: admin.firestore.FieldValue.arrayRemove(id),
		profiles: admin.firestore.FieldValue.arrayUnion({
			id: context.auth.uid,
			email: context.auth.token.email,
			displayName: userInfo.displayName
		})
	});

	batch.delete(invitation.ref);
	await batch.commit();
});

exports.rejectInvitation = functions.https.onCall(async (data, context) => {
	if (!context.auth) {
		throw new functions.https.HttpsError('unauthenticated');
	}

	let id = data.id;
	let invitation = await firestore.collection('invitations').doc(id).get();
	if (!invitation.exists) {
		throw new functions.https.HttpsError('not-found');
	}

	let batch = firestore.batch();
	batch.delete(invitation.ref);
	batch.update(firestore.collection('groups').doc(invitation.data().groupId), {
		invitations: admin.firestore.FieldValue.arrayRemove(id)
	});

	await batch.commit();
});
