// functions/utils/firebase/firebase_ops.js

const admin = require("firebase-admin");

class FirebaseOps {
  constructor() {
    this._initializeApp();
    this.db = admin.firestore();
  }

  _initializeApp() {
    if (!admin.apps.length) {
      admin.initializeApp();
    }
  }

  getFirestore() {
    return this.db;
  }

  getTimestamp() {
    return admin.firestore.FieldValue.serverTimestamp();
  }

  async createDocument(collectionName, data, documentId = null) {
    if (!collectionName || typeof collectionName !== "string") {
      throw new Error("Invalid collection name.");
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Invalid document data.");
    }

    if (documentId) {
      const docRef = this.db.collection(collectionName).doc(documentId);
      await docRef.set(data);
      return {
        id: docRef.id,
        ref: docRef
      };
    }

    const docRef = await this.db.collection(collectionName).add(data);
    return {
      id: docRef.id,
      ref: docRef
    };
  }

  async readDocument(collectionName, documentId) {
    if (!collectionName || typeof collectionName !== "string") {
      throw new Error("Invalid collection name.");
    }

    if (!documentId || typeof documentId !== "string") {
      throw new Error("Invalid document ID.");
    }

    const docSnap = await this.db.collection(collectionName).doc(documentId).get();

    if (!docSnap.exists) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data()
    };
  }

  async updateDocument(collectionName, documentId, data) {
    if (!collectionName || typeof collectionName !== "string") {
      throw new Error("Invalid collection name.");
    }

    if (!documentId || typeof documentId !== "string") {
      throw new Error("Invalid document ID.");
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Invalid update data.");
    }

    await this.db.collection(collectionName).doc(documentId).update(data);

    return {
      id: documentId
    };
  }

  async setDocument(collectionName, documentId, data, merge = true) {
    if (!collectionName || typeof collectionName !== "string") {
      throw new Error("Invalid collection name.");
    }

    if (!documentId || typeof documentId !== "string") {
      throw new Error("Invalid document ID.");
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Invalid set data.");
    }

    await this.db.collection(collectionName).doc(documentId).set(data, {merge});

    return {
      id: documentId
    };
  }

  async deleteDocument(collectionName, documentId) {
    if (!collectionName || typeof collectionName !== "string") {
      throw new Error("Invalid collection name.");
    }

    if (!documentId || typeof documentId !== "string") {
      throw new Error("Invalid document ID.");
    }

    await this.db.collection(collectionName).doc(documentId).delete();

    return {
      id: documentId
    };
  }

  async queryDocuments(
    collectionName,
    fieldName,
    operator,
    value,
    options = {}
  ) {
    if (!collectionName || typeof collectionName !== "string") {
      throw new Error("Invalid collection name.");
    }

    if (!fieldName || typeof fieldName !== "string") {
      throw new Error("Invalid field name.");
    }

    if (!operator || typeof operator !== "string") {
      throw new Error("Invalid query operator.");
    }

    let queryRef = this.db.collection(collectionName).where(fieldName, operator, value);

    if (options.orderBy && typeof options.orderBy === "string") {
      queryRef = queryRef.orderBy(
        options.orderBy,
        options.orderDirection === "desc" ? "desc" : "asc"
      );
    }

    if (
      typeof options.limit === "number" &&
      Number.isInteger(options.limit) &&
      options.limit > 0
    ) {
      queryRef = queryRef.limit(options.limit);
    }

    const snapshot = await queryRef.get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  async listDocuments(collectionName, options = {}) {
    if (!collectionName || typeof collectionName !== "string") {
      throw new Error("Invalid collection name.");
    }

    let queryRef = this.db.collection(collectionName);

    if (options.orderBy && typeof options.orderBy === "string") {
      queryRef = queryRef.orderBy(
        options.orderBy,
        options.orderDirection === "desc" ? "desc" : "asc"
      );
    }

    if (
      typeof options.limit === "number" &&
      Number.isInteger(options.limit) &&
      options.limit > 0
    ) {
      queryRef = queryRef.limit(options.limit);
    }

    const snapshot = await queryRef.get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
  }
}

module.exports = new FirebaseOps();
module.exports.FirebaseOps = FirebaseOps;