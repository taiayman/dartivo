'use client';

import React from 'react';
import { Timestamp, FieldValue } from 'firebase/firestore';

// --- Type Definitions ---

export interface FileTreeNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileTreeNode[];
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  createdAt?: Timestamp | FieldValue;
  toolName?: string;
  displayContent?: string;
  editProposal?: {
    path: string;
    // Add other properties as needed
  };
  createProposal?: {
    path: string;
    // Add other properties as needed
  };
}

export const INITIAL_ASSISTANT_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: '',
  createdAt: Timestamp.now()
};

export interface ChatHistoryItem {
  id: string;
  title: string | null;
  createdAt: Timestamp;
}

// --- Props passed TO ChatInterface ---
export interface ChatInterfaceClientProps {
  projectId: string | undefined;
  isHovered: boolean;
  isChatLocked: boolean;
  currentChatId: string | null;
  currentChatTitle: string;
  messages: ChatMessage[];
  isLoadingMessages: boolean;
  isAiResponding: boolean;
  onSendMessage: (userMessageContent: string) => Promise<void>;
  onStopGeneration: () => void;
  viewMode: 'chats' | 'teammate';
  onViewModeChange: (newMode: 'chats' | 'teammate') => void;
  onSaveEdit: (messageId: string, newContent: string) => Promise<void>;
}

// --- Props passed TO RightSidebar ---
export interface RightSidebarClientProps {
  width: number;
  onResizeStart: (event: React.MouseEvent | React.TouchEvent) => void;
  chatHistoryList: ChatHistoryItem[];
  isLoadingHistory: boolean;
  currentChatId: string | null;
  loadChat: (chatId: string) => void;
  handleDeleteChat: (chatId: string) => void;
  fetchChatHistory: () => void;
  viewMode: 'chats' | 'teammate';
}

// --- Helper: Insert node into tree state immutably ---
export const insertNodeIntoTree = (tree: FileTreeNode[] | null, basePath: string | null, newNode: FileTreeNode): FileTreeNode[] => {
    const newTree = tree ? JSON.parse(JSON.stringify(tree)) : [];
    const insertSorted = (children: FileTreeNode[], node: FileTreeNode): void => {
        children.push(node);
        children.sort((a, b) => {
            if (a.type === 'folder' && b.type === 'file') return -1;
            if (a.type === 'file' && b.type === 'folder') return 1;
            return a.name.localeCompare(b.name);
        });
    };

    if (!basePath) {
        insertSorted(newTree, newNode);
    } else {
        const parts = basePath.split('/');
        let currentLevel = newTree;
        let parentNode: FileTreeNode | undefined;
        for (const part of parts) {
            parentNode = currentLevel.find((node: FileTreeNode) => node.name === part && node.type === 'folder');
            if (!parentNode) {
                console.error(`Optimistic update failed: Parent folder not found at ${basePath}`);
                return tree || [];
            }
            parentNode.children = parentNode.children || [];
            currentLevel = parentNode.children;
        }
        if (parentNode && parentNode.children) {
            insertSorted(parentNode.children, newNode);
        } else {
            console.error(`Optimistic update failed: Could not find children array for ${basePath}`);
            return tree || [];
        }
    }
    return newTree;
};