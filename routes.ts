import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { analyzeDocument } from "./document-analyzer";
import multer from "multer";
import path from "path";
import fs from "fs";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { insertDocumentSchema } from "@shared/schema";

// Setup file upload with multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedFileTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ];
    if (allowedFileTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, JPG, and PNG files are allowed.') as any);
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // sets up /api/register, /api/login, /api/logout, /api/user
  setupAuth(app);

  // Document upload endpoint
  app.post('/api/documents/upload', upload.single('file'), async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    try {
      // Extract file information
      const { originalname, mimetype, buffer, size } = req.file;
      const fileType = mimetype;
      const userId = req.user!.id;
      
      // Infer document type from filename (simplified)
      let documentType = 'Unknown';
      if (originalname.toLowerCase().includes('agreement') || originalname.toLowerCase().includes('contract')) {
        documentType = 'Agreement';
      } else if (originalname.toLowerCase().includes('deed')) {
        documentType = 'Deed';
      } else if (originalname.toLowerCase().includes('invoice')) {
        documentType = 'Invoice';
      }
      
      // Create document in database
      const documentData = {
        userId,
        fileName: originalname,
        fileType,
        fileSize: size,
        documentType
      };
      
      try {
        const validatedData = insertDocumentSchema.parse(documentData);
        const document = await storage.createDocument(validatedData);
        
        // Convert buffer to text content (this would use different parsers based on file type)
        const content = buffer.toString('base64');
        await storage.updateDocumentContent(document.id, content);
        
        // Analyze the document
        const analysis = await analyzeDocument(document);
        
        res.status(201).json({ document, analysis });
      } catch (err) {
        if (err instanceof ZodError) {
          const validationError = fromZodError(err);
          return res.status(400).json({ message: validationError.message });
        }
        throw err;
      }
    } catch (error: any) {
      console.error('Error uploading document:', error);
      res.status(500).json({ message: error.message || 'Error uploading document' });
    }
  });

  // Get user's documents with analysis data
  app.get('/api/documents', async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    try {
      const documents = await storage.getDocumentsByUserId(req.user!.id);
      
      // Fetch analysis data for each document
      const documentsWithAnalysis = await Promise.all(
        documents.map(async (doc) => {
          const analysis = await storage.getAnalysisByDocumentId(doc.id);
          return {
            ...doc,
            analysis: analysis || null
          };
        })
      );
      
      console.log(`Fetched ${documentsWithAnalysis.length} documents with analysis`);
      res.json(documentsWithAnalysis);
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      res.status(500).json({ message: error.message || 'Error fetching documents' });
    }
  });

  // Get document by ID
  app.get('/api/documents/:id', async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    try {
      const document = await storage.getDocument(parseInt(req.params.id));
      
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }
      
      if (document.userId !== req.user!.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      // Get analysis for this document
      const analysis = await storage.getAnalysisByDocumentId(document.id);
      
      res.json({ document, analysis });
    } catch (error: any) {
      console.error('Error fetching document:', error);
      res.status(500).json({ message: error.message || 'Error fetching document' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
