# Eunhye Secretary

A personal archive companion for exploring professional work, research, qualifications, and publications through a clean web interface and an AI-assisted chat.

Live site: https://canelo-phd.github.io/eunhye-secretary/

## Meet the AI Secretary

<p align="center">
  <img src="web/%EC%9D%80%ED%98%9C_%EB%B9%84%EC%84%9C_%EC%9D%B8%EB%AC%BC%EC%82%AC%EC%A7%84.png" alt="Eunhye, the AI secretary" width="360">
</p>

The chat is designed for natural questions about the public archive. It can locate relevant material, compare information across documents, and present grounded summaries with links to the source documents.

## What the app includes

- About page with a professional introduction and public profile links
- AI secretary chat for archive-based questions
- Wiki Search workspace for browsing folders, documents, and previews
- Source links below grounded chat responses
- English and Korean interface support
- Search designed to handle multilingual document names and content

## App structure

The app is organized into three connected experiences:

1. About
   A concise professional profile and a starting point for visitors.

2. Chat
   A conversational assistant that finds relevant public archive content before answering. Responses can cite the documents used so visitors can inspect the source material directly.

3. Wiki Search
   A document workspace with a folder tree, searchable file list, and inline preview for supported documents.

The user interface and public documents are published as a static website. The AI request handling is kept separate so private configuration remains outside the public website.

## Public archive

Documents shown in Wiki Search are intentionally published for visitors to view. Source links in chat responses open the corresponding document in the Wiki Search workspace.

## Privacy and security

Private credentials and deployment configuration are not included in this repository or exposed in the public website.
