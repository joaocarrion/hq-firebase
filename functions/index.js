/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");


const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

logger.log('Hello, logs!');
exports.updateCategoryMetadata = functions.firestore
	.document('group/{groupId}/categories/{categoryId}')
	.onWrite((change, context) => {
		logger.log('updateCategoryMetadata');
		const groupId = context.params.groupId;
		const categoryId = context.params.categoryId;
		logger.log(`Category ${categoryId} updated in group ${groupId}`);

		// Get the metadata document reference
		const metadataRef = admin.firestore().collection('groups').doc(groupId).collection('metadata').doc('categories');

		// Update the metadata document with the server timestamp
		return metadataRef.set({
			lastUpdated: admin.firestore.FieldValue.serverTimestamp()
		}, { merge: true });
	});
