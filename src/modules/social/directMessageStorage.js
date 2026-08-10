import { prisma } from '../../config/prisma.js';

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

export const getDirectMessagesFromStorage = async (email1, email2) => {
  const e1 = normalizeEmail(email1);
  const e2 = normalizeEmail(email2);
  if (!e1 || !e2) return [];

  try {
    const dbMessages = await prisma.message.findMany({
      where: {
        OR: [
          { senderEmail: e1, receiverEmail: e2 },
          { senderEmail: e2, receiverEmail: e1 },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    return dbMessages.map((m) => ({
      id: m.id,
      content: m.content || m.text || '',
      text: m.text || m.content || '',
      message: m.text || m.content || '',
      type: m.type || (m.fileKey || m.fileUrl ? 'FILE' : 'message'),
      fileName: m.fileName,
      fileKey: m.fileKey,
      fileUrl: m.fileUrl,
      contentType: m.contentType,
      senderEmail: m.senderEmail,
      receiverEmail: m.receiverEmail,
      email: m.senderEmail,
      createdAt: m.createdAt ? m.createdAt.toISOString() : new Date().toISOString(),
      timestamp: m.createdAt ? m.createdAt.toISOString() : new Date().toISOString(),
    }));
  } catch (dbError) {
    console.error('Error fetching direct messages from database:', dbError);
    return [];
  }
};

export const saveDirectMessageToStorage = async (messagePayload) => {
  if (!messagePayload) return null;

  const senderEmail = normalizeEmail(messagePayload.senderEmail || messagePayload.email || messagePayload.sender || '');
  const receiverEmail = normalizeEmail(messagePayload.receiverEmail || messagePayload.receiver || messagePayload.to || '');

  if (!senderEmail || !receiverEmail) return null;

  const content = messagePayload.content || messagePayload.text || messagePayload.message || '';
  const messageType = messagePayload.type || (messagePayload.fileKey || messagePayload.fileUrl ? 'FILE' : 'message');

  try {
    const created = await prisma.message.create({
      data: {
        id: (messagePayload.id && !messagePayload.id.startsWith('temp')) ? messagePayload.id : undefined,
        content,
        text: messagePayload.text || content,
        type: messageType,
        fileName: messagePayload.fileName || null,
        fileKey: messagePayload.fileKey || null,
        fileUrl: messagePayload.fileUrl || null,
        contentType: messagePayload.contentType || null,
        senderEmail,
        receiverEmail,
      },
    });

    return {
      id: created.id,
      ...messagePayload,
      senderEmail,
      receiverEmail,
      email: senderEmail,
      content: created.content,
      text: created.text || created.content,
      message: created.text || created.content,
      type: created.type,
      fileName: created.fileName,
      fileKey: created.fileKey,
      fileUrl: created.fileUrl,
      contentType: created.contentType,
      createdAt: created.createdAt.toISOString(),
      timestamp: created.createdAt.toISOString(),
    };
  } catch (dbError) {
    console.error('Error saving direct message to database:', dbError);
    const timestamp = messagePayload.timestamp || messagePayload.createdAt || new Date().toISOString();
    return {
      id: messagePayload.id || `dm-${Date.now()}`,
      ...messagePayload,
      senderEmail,
      receiverEmail,
      email: senderEmail,
      timestamp,
      createdAt: timestamp,
    };
  }
};
