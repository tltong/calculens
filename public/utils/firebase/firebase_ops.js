// public/utils/firebase/firebase_ops.js

import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { initFirebase, getFirebaseApp } from "/utils/firebase/firebase.js";

let db = null;

/**
 * Initialize Firestore singleton
 */
function initFirestore() {
  if (!db) {
    initFirebase();
    db = getFirestore(getFirebaseApp());
    console.log("[Firestore] Initialized");
  }
  return db;
}

/**
 * Get Firestore instance
 */
function getFirestoreDB() {
  if (!db) {
    throw new Error("[Firestore] Not initialized. Call initFirestore() first.");
  }
  return db;
}

/**
 * Add a new document with auto-generated ID
 * @param {string} collectionName
 * @param {Object} data
 * @returns {Promise<string>} document ID
 */
async function addDocument(collectionName, data) {
  try {
    const firestore = initFirestore();
    const collectionRef = collection(firestore, collectionName);
    const docRef = await addDoc(collectionRef, data);
    return docRef.id;
  } catch (error) {
    console.error("[Firestore] addDocument error:", error);
    throw error;
  }
}

/**
 * Create or overwrite a document with a specific ID
 * @param {string} collectionName
 * @param {string} docId
 * @param {Object} data
 */
async function setDocument(collectionName, docId, data) {
  try {
    const firestore = initFirestore();
    const docRef = doc(firestore, collectionName, docId);
    await setDoc(docRef, data);
  } catch (error) {
    console.error("[Firestore] setDocument error:", error);
    throw error;
  }
}

/**
 * Read a single document
 * @param {string} collectionName
 * @param {string} docId
 * @returns {Promise<Object|null>}
 */
async function getDocument(collectionName, docId) {
  try {
    const firestore = initFirestore();
    const docRef = doc(firestore, collectionName, docId);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
      return null;
    }

    return {
      id: snapshot.id,
      ...snapshot.data()
    };
  } catch (error) {
    console.error("[Firestore] getDocument error:", error);
    throw error;
  }
}

/**
 * Read all documents in a collection
 * @param {string} collectionName
 * @returns {Promise<Array>}
 */
async function getCollection(collectionName) {
  try {
    const firestore = initFirestore();
    const collectionRef = collection(firestore, collectionName);
    const snapshot = await getDocs(collectionRef);

    return snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data()
    }));
  } catch (error) {
    console.error("[Firestore] getCollection error:", error);
    throw error;
  }
}

/**
 * Update specific fields in a document
 * @param {string} collectionName
 * @param {string} docId
 * @param {Object} data
 */
async function updateDocument(collectionName, docId, data) {
  try {
    const firestore = initFirestore();
    const docRef = doc(firestore, collectionName, docId);
    await updateDoc(docRef, data);
  } catch (error) {
    console.error("[Firestore] updateDocument error:", error);
    throw error;
  }
}

/**
 * Delete a document
 * @param {string} collectionName
 * @param {string} docId
 */
async function deleteDocument(collectionName, docId) {
  try {
    const firestore = initFirestore();
    const docRef = doc(firestore, collectionName, docId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("[Firestore] deleteDocument error:", error);
    throw error;
  }
}

/**
 * Read documents from a collection path.
 * @param {string[]} pathSegments
 * @returns {Promise<Array>}
 */
async function getCollectionDocumentsByPath(pathSegments) {
  validateCollectionPathSegments(pathSegments);

  try {
    const firestore = initFirestore();
    const collectionRef = collection(firestore, ...pathSegments);
    const snapshot = await getDocs(collectionRef);

    return snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data()
    }));
  } catch (error) {
    console.error("[Firestore] getCollectionDocumentsByPath error:", error);
    throw error;
  }
}

/**
 * Delete a document by path.
 * @param {string[]} pathSegments
 */
async function deleteDocumentByPath(pathSegments) {
  validateDocumentPathSegments(pathSegments);

  try {
    const firestore = initFirestore();
    const docRef = doc(firestore, ...pathSegments);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("[Firestore] deleteDocumentByPath error:", error);
    throw error;
  }
}

/**
 * Query documents by a field
 * @param {string} collectionName
 * @param {string} fieldName
 * @param {import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js").WhereFilterOp} operator
 * @param {*} value
 * @returns {Promise<Array>}
 */
async function queryDocuments(collectionName, fieldName, operator, value) {
  try {
    const firestore = initFirestore();
    const collectionRef = collection(firestore, collectionName);
    const q = query(collectionRef, where(fieldName, operator, value));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data()
    }));
  } catch (error) {
    console.error("[Firestore] queryDocuments error:", error);
    throw error;
  }
}

/**
 * Get documents with ordering and optional limit
 * @param {string} collectionName
 * @param {string} orderField
 * @param {"asc"|"desc"} direction
 * @param {number|null} maxResults
 * @returns {Promise<Array>}
 */
async function getOrderedDocuments(
  collectionName,
  orderField,
  direction = "asc",
  maxResults = null
) {
  try {
    const firestore = initFirestore();
    const collectionRef = collection(firestore, collectionName);

    const constraints = [orderBy(orderField, direction)];
    if (maxResults !== null) {
      constraints.push(limit(maxResults));
    }

    const q = query(collectionRef, ...constraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data()
    }));
  } catch (error) {
    console.error("[Firestore] getOrderedDocuments error:", error);
    throw error;
  }
}

/**
 * Add a new document to a direct subcollection.
 * @param {string} parentCollectionName
 * @param {string} parentDocId
 * @param {string} subcollectionName
 * @param {Object} data
 * @returns {Promise<string>} document ID
 */
async function addSubcollectionDocument(
  parentCollectionName,
  parentDocId,
  subcollectionName,
  data
) {
  try {
    const firestore = initFirestore();
    const collectionRef = collection(
      firestore,
      parentCollectionName,
      parentDocId,
      subcollectionName
    );
    const docRef = await addDoc(collectionRef, data);
    return docRef.id;
  } catch (error) {
    console.error("[Firestore] addSubcollectionDocument error:", error);
    throw error;
  }
}

/**
 * Read one document from a direct subcollection.
 * @param {string} parentCollectionName
 * @param {string} parentDocId
 * @param {string} subcollectionName
 * @param {string} docId
 * @returns {Promise<Object|null>}
 */
async function getSubcollectionDocument(
  parentCollectionName,
  parentDocId,
  subcollectionName,
  docId
) {
  try {
    const firestore = initFirestore();
    const docRef = doc(
      firestore,
      parentCollectionName,
      parentDocId,
      subcollectionName,
      docId
    );
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
      return null;
    }

    return {
      id: snapshot.id,
      ...snapshot.data()
    };
  } catch (error) {
    console.error("[Firestore] getSubcollectionDocument error:", error);
    throw error;
  }
}

/**
 * Listen to one document from a direct subcollection.
 * @param {string} parentCollectionName
 * @param {string} parentDocId
 * @param {string} subcollectionName
 * @param {string} docId
 * @param {(documentData: Object|null) => void} onNext
 * @param {(error: Error) => void} onError
 * @returns {() => void}
 */
function listenToSubcollectionDocument(
  parentCollectionName,
  parentDocId,
  subcollectionName,
  docId,
  onNext,
  onError
) {
  try {
    const firestore = initFirestore();
    const docRef = doc(
      firestore,
      parentCollectionName,
      parentDocId,
      subcollectionName,
      docId
    );

    return onSnapshot(
      docRef,
      (snapshot) => {
        onNext(
          snapshot.exists()
            ? {
                id: snapshot.id,
                ...snapshot.data()
              }
            : null
        );
      },
      onError
    );
  } catch (error) {
    console.error("[Firestore] listenToSubcollectionDocument error:", error);
    throw error;
  }
}

/**
 * Get ordered documents from a direct subcollection.
 * @param {string} parentCollectionName
 * @param {string} parentDocId
 * @param {string} subcollectionName
 * @param {string} orderField
 * @param {"asc"|"desc"} direction
 * @param {number|null} maxResults
 * @returns {Promise<Array>}
 */
async function getOrderedSubcollectionDocuments(
  parentCollectionName,
  parentDocId,
  subcollectionName,
  orderField,
  direction = "asc",
  maxResults = null
) {
  try {
    const firestore = initFirestore();
    const collectionRef = collection(
      firestore,
      parentCollectionName,
      parentDocId,
      subcollectionName
    );

    const constraints = [orderBy(orderField, direction)];
    if (maxResults !== null) {
      constraints.push(limit(maxResults));
    }

    const q = query(collectionRef, ...constraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data()
    }));
  } catch (error) {
    console.error("[Firestore] getOrderedSubcollectionDocuments error:", error);
    throw error;
  }
}

/**
 * Listen to ordered documents from a direct subcollection.
 * @param {string} parentCollectionName
 * @param {string} parentDocId
 * @param {string} subcollectionName
 * @param {string} orderField
 * @param {"asc"|"desc"} direction
 * @param {number|null} maxResults
 * @param {(documents: Array) => void} onNext
 * @param {(error: Error) => void} onError
 * @returns {() => void}
 */
function listenToOrderedSubcollectionDocuments(
  parentCollectionName,
  parentDocId,
  subcollectionName,
  orderField,
  direction = "asc",
  maxResults = null,
  onNext,
  onError
) {
  try {
    const firestore = initFirestore();
    const collectionRef = collection(
      firestore,
      parentCollectionName,
      parentDocId,
      subcollectionName
    );

    const constraints = [orderBy(orderField, direction)];
    if (maxResults !== null) {
      constraints.push(limit(maxResults));
    }

    const q = query(collectionRef, ...constraints);

    return onSnapshot(
      q,
      (snapshot) => {
        onNext(
          snapshot.docs.map((docItem) => ({
            id: docItem.id,
            ...docItem.data()
          }))
        );
      },
      onError
    );
  } catch (error) {
    console.error("[Firestore] listenToOrderedSubcollectionDocuments error:", error);
    throw error;
  }
}

function validateCollectionPathSegments(pathSegments) {
  validatePathSegments(pathSegments);

  if (pathSegments.length % 2 === 0) {
    throw new Error("Collection path must have an odd number of segments.");
  }
}

function validateDocumentPathSegments(pathSegments) {
  validatePathSegments(pathSegments);

  if (pathSegments.length % 2 !== 0) {
    throw new Error("Document path must have an even number of segments.");
  }
}

function validatePathSegments(pathSegments) {
  if (!Array.isArray(pathSegments) || pathSegments.length === 0) {
    throw new Error("pathSegments must be a non-empty array.");
  }

  pathSegments.forEach((pathSegment) => {
    if (!pathSegment || typeof pathSegment !== "string") {
      throw new Error("pathSegments must contain non-empty strings.");
    }
  });
}

export {
  initFirestore,
  getFirestoreDB,
  addDocument,
  setDocument,
  getDocument,
  getCollection,
  updateDocument,
  deleteDocument,
  getCollectionDocumentsByPath,
  deleteDocumentByPath,
  queryDocuments,
  getOrderedDocuments,
  addSubcollectionDocument,
  getSubcollectionDocument,
  listenToSubcollectionDocument,
  getOrderedSubcollectionDocuments,
  listenToOrderedSubcollectionDocuments
};
