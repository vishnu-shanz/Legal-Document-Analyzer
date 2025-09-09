import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  email: text("email"),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  documentType: text("document_type"),
  status: text("status").notNull().default("pending"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  content: text("content"),
});

export const analyses = pgTable("analyses", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  isValid: boolean("is_valid"),
  complianceStatus: text("compliance_status"),
  issuesCount: integer("issues_count").default(0),
  warnings: text("warnings").array(),
  recommendations: text("recommendations").array(),
  analysisData: text("analysis_data"), // JSON stringified data
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  email: true,
});

export const insertDocumentSchema = createInsertSchema(documents).pick({
  userId: true,
  fileName: true,
  fileType: true,
  fileSize: true,
  documentType: true,
});

export const insertAnalysisSchema = createInsertSchema(analyses).pick({
  documentId: true,
  isValid: true,
  complianceStatus: true,
  issuesCount: true,
  warnings: true,
  recommendations: true,
  analysisData: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analyses.$inferSelect;

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginData = z.infer<typeof loginSchema>;

export const registerSchema = insertUserSchema.extend({
  confirmPassword: z.string().min(1, "Password confirmation is required"),
  terms: z.boolean().refine(val => val === true, {
    message: "You must accept the terms and privacy policy",
  }),
});
