import { setGlobalOptions } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
setGlobalOptions({
    region: "southamerica-east1",
    enforceAppCheck: true
});
export class FBServices {
    app;
    db;
    static errors = {
        unauthenticated: () => ({
            code: 401,
            reason: "unauthenticated",
            message: "User is not authenticated"
        }),
        invalidArgument: () => ({
            code: 400,
            reason: "invalid-argument",
            message: "Invalid argument"
        }),
        notFound: () => ({
            code: 404,
            reason: "not-found",
            message: "Resource not found"
        }),
        permissionDenied: () => ({
            code: 403,
            reason: "permission-denied",
            message: "Permission denied"
        })
    };
    constructor() {
        this.app = initializeApp();
        this.db = getFirestore();
    }
    isNotEmulator() {
        return process.env.FIREBASE_EMULATOR_HUB === undefined;
    }
    isEmulator() {
        return !this.isNotEmulator();
    }
}
export const services = new FBServices();
