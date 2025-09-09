import { users, documents, analyses, type User, type InsertUser, type Document, type InsertDocument, type Analysis, type InsertAnalysis } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Document methods
  createDocument(document: InsertDocument): Promise<Document>;
  getDocument(id: number): Promise<Document | undefined>;
  getDocumentsByUserId(userId: number): Promise<Document[]>;
  updateDocumentStatus(id: number, status: string): Promise<Document | undefined>;
  updateDocumentContent(id: number, content: string): Promise<Document | undefined>;
  
  // Analysis methods
  createAnalysis(analysis: InsertAnalysis): Promise<Analysis>;
  getAnalysis(id: number): Promise<Analysis | undefined>;
  getAnalysisByDocumentId(documentId: number): Promise<Analysis | undefined>;
  
  sessionStore: session.SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private documents: Map<number, Document>;
  private analyses: Map<number, Analysis>;
  sessionStore: session.SessionStore;
  currentUserId: number;
  currentDocumentId: number;
  currentAnalysisId: number;

  constructor() {
    this.users = new Map();
    this.documents = new Map();
    this.analyses = new Map();
    this.currentUserId = 1;
    this.currentDocumentId = 1;
    this.currentAnalysisId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Document methods
  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const id = this.currentDocumentId++;
    const now = new Date();
    const document: Document = { 
      ...insertDocument, 
      id,
      status: "pending",
      uploadedAt: now,
      content: ""
    };
    this.documents.set(id, document);
    return document;
  }
  
  async getDocument(id: number): Promise<Document | undefined> {
    return this.documents.get(id);
  }
  
  async getDocumentsByUserId(userId: number): Promise<Document[]> {
    return Array.from(this.documents.values())
      .filter((doc) => doc.userId === userId)
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }
  
  async updateDocumentStatus(id: number, status: string): Promise<Document | undefined> {
    const document = await this.getDocument(id);
    if (document) {
      const updatedDocument = { ...document, status };
      this.documents.set(id, updatedDocument);
      return updatedDocument;
    }
    return undefined;
  }
  
  async updateDocumentContent(id: number, content: string): Promise<Document | undefined> {
    const document = await this.getDocument(id);
    if (document) {
      const updatedDocument = { ...document, content };
      this.documents.set(id, updatedDocument);
      return updatedDocument;
    }
    return undefined;
  }
  
  // Analysis methods
  async createAnalysis(insertAnalysis: InsertAnalysis): Promise<Analysis> {
    const id = this.currentAnalysisId++;
    const now = new Date();
    const analysis: Analysis = { 
      ...insertAnalysis, 
      id,
      createdAt: now
    };
    this.analyses.set(id, analysis);
    return analysis;
  }
  
  async getAnalysis(id: number): Promise<Analysis | undefined> {
    return this.analyses.get(id);
  }
  
  async getAnalysisByDocumentId(documentId: number): Promise<Analysis | undefined> {
    return Array.from(this.analyses.values()).find(
      (analysis) => analysis.documentId === documentId,
    );
  }
}

export const storage = new MemStorage();
