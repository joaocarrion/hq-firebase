// INITIALIZE
const admin = require('firebase-admin');
admin.initializeApp();

const firestore = admin.firestore();
const functions = require('firebase-functions');

const unauthenticatedError = new functions.https.HttpsError('unauthenticated', 'User is not authenticated');
const invalidArgumentError = new functions.https.HttpsError('invalid-argument', 'Invalid argument');
const notFoundError = new functions.https.HttpsError('not-found', 'Resource not found');
const permissionDeniedError = new functions.https.HttpsError('permission-denied', 'Permission denied');

const callable = functions.region('southamerica-east1').https;

exports.fixProductPurchases = callable.onCall(async (data, context) => {
	if (!context.auth || context.auth.token.email != 'joao.carrion@gmail.com') {
		// console.log(JSON.stringify(context.auth));
		throw unauthenticatedError;
	}

	console.log("Loading collection");
	let collection = firestore.collection(`/groups/207AA34E-581A-43ED-A85D-94A87C000969/purchases`);
	let snapshot = await collection.get();

	if (!snapshot || snapshot.empty) {
		console.log('No purchases found');
		return;
	}

	let documents = snapshot.docs.map(doc => doc.data());
	var toFix = [];
	documents.forEach(doc => {
		if (doc.products && doc.products.length > 0) {
			// check if doc.products[0].product is a string
			if (typeof doc.products[0].product !== 'string') {
				toFix.push(doc);
			}
		}
	});

	if (toFix.length === 0) {
		console.log('No purchases to fix');
		return;
	}

	let batch = firestore.batch();
	toFix.forEach(doc => {
		let docRef = collection.doc(doc.id);
		let products = doc.products.map(purchasedProduct => ({
			...purchasedProduct,
			product: purchasedProduct.product.id
		}));

		var newDoc = doc;
		newDoc.products = products;
		console.log('Fixed: ', JSON.stringify(newDoc.products[0]));
		batch.set(docRef, newDoc);
	});

	await batch.commit();
	console.log('Fixed purchases: ', toFix.length);
	return { fixedCount: toFix.length };
});

exports.acceptInvitation = callable.onCall(async (data, context) => {
	if (!context.auth) {
		throw unauthenticatedError;
	}

	let id = data.id;
	let userInfo = data.user;
	if (!id || !userInfo) {
		throw invalidArgumentError;
	}

	let invitation = await firestore.collection('invitations').doc(id).get();
	if (!invitation.exists) {
		throw notFoundError;
	}

	let groupRef = firestore.collection('groups').doc(invitation.data().groupId);
	let group = await groupRef.get();
	if (!group.exists) {
		throw notFoundError;
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
		};

		batch.set(userProfileRef, profileInfo);
	} else {
		batch.update(userProfileRef, {
			id: userInfo.id,
			name: userInfo.name,
			email: context.auth.token.email,
			displayName: userInfo.displayName,
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

exports.rejectInvitation = callable.onCall(async (data, context) => {
	if (!context.auth) {
		throw unauthenticatedError;
	}

	let id = data.id;
	if (!id) {
		throw invalidArgumentError;
	}

	let invitation = await firestore.collection('invitations').doc(id).get();
	if (!invitation.exists) {
		throw notFoundError;
	}

	let batch = firestore.batch();
	batch.delete(invitation.ref);
	batch.update(firestore.collection('groups').doc(invitation.data().groupId), {
		invitations: admin.firestore.FieldValue.arrayRemove(id)
	});

	await batch.commit();
});

exports.removeUser = callable.onCall(async (data, context) => {
	if (!context.auth) {
		throw unauthenticatedError;
	}

	let group = await firestore.collection('groups').doc(data.gid).get();
	if (!group.exists) {
		throw notFoundError;
	}

	if (!group.data().admins.includes(context.auth.uid)) {
		throw permissionDeniedError;
	}

	if (!group.data().users.includes(data.uid)) {
		throw notFoundError;
	}
	
	let user = await firestore.collection('user_profiles').doc(data.uid).get();
	if (!user.exists) {
		throw notFoundError;
	}

	let batch = firestore.batch();
	batch.update(firestore.collection('groups').doc(data.gid), {
		users: admin.firestore.FieldValue.arrayRemove(data.uid),
		admins: admin.firestore.FieldValue.arrayRemove(data.uid),
		profiles: admin.firestore.FieldValue.arrayRemove(group.data().profiles.find(p => p.id === data.uid))
	});

	var updateData = {
		groups: admin.firestore.FieldValue.arrayRemove(data.gid),
	};

	if (user.data().defaultGroup === data.gid) {
		updateData.defaultGroup = admin.firestore.FieldValue.delete();
	}

	batch.update(firestore.collection('user_profiles').doc(data.uid), updateData);

	await batch.commit();
});

exports.leaveGroup = callable.onCall(async (data, context) => {
	if (!context.auth) {
		throw unauthenticatedError;
	}

	if (!data.gid) {
		throw invalidArgumentError;
	}

	let group = await firestore.collection('groups').doc(data.gid).get();
	if (!group.exists) {
		throw notFoundError;
	}

	if (!group.data().users.includes(context.auth.uid)) {
		throw notFoundError;
	}

	let user = await firestore.collection('user_profiles').doc(context.auth.uid).get();
	if (!user.exists) {
		throw notFoundError;
	}

	let batch = firestore.batch();
	batch.update(firestore.collection('groups').doc(data.gid), {
		users: admin.firestore.FieldValue.arrayRemove(context.auth.uid),
		admins: admin.firestore.FieldValue.arrayRemove(context.auth.uid),
		profiles: admin.firestore.FieldValue.arrayRemove(group.data().profiles.find(p => p.id === context.auth.uid))
	});

	var updateData = {
		groups: admin.firestore.FieldValue.arrayRemove(data.gid),
	};

	if (user.data().defaultGroup === data.gid) {
		updateData.defaultGroup = admin.firestore.FieldValue.delete();
	}

	batch.update(firestore.collection('user_profiles').doc(context.auth.uid), updateData);

	await batch.commit();
});

exports.createInvitation = callable.onCall(async (data, context) => {
	if (!context.auth) {
		throw unauthenticatedError;
	}

	let gid = data.gid;
	let name = data.name;
	let description = data.description;
	let invitedBy = data.invitedBy;

	if (!gid || !name || !description || !invitedBy) {
		console.log(`Invalid parameters gid: ${gid}, name: ${name}, description: ${description}, invitedBy: ${invitedBy}`);
		throw invalidArgumentError;
	}

	let group = await firestore.collection('groups').doc(gid).get();
	if (!group.exists) {
		throw notFoundError;
	}

	if (!group.data().admins.includes(context.auth.uid)) {
		throw permissionDeniedError;
	}

	console.log("Is group admin");
	let invitationData = {
		groupId: data.gid,
		name: data.name,
		description: data.description,
		invitedBy: data.invitedBy,
		state: 'undefined',
		createdAt: admin.firestore.FieldValue.serverTimestamp(),
	};

	let batch = firestore.batch();
	let invitation = await firestore.collection('invitations').doc();
	batch.set(invitation, invitationData);

	console.log("Invitation created: " + invitation.id);
	batch.update(group.ref, {
		invitations: admin.firestore.FieldValue.arrayUnion(invitation.id)
	});

	await batch.commit();
	
	return invitation.id;
});
