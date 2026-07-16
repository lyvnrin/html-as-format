# Overview

## 1. Problem Statement

Consultants get handed a ton of source material — meeting transcripts, decks, PDFs — and have to sit through all of it just to dig out the useful bits. Most of what's in there isn't even relevant to what's needed in the moment, and it eats a lot of time. The goal is something that takes that raw material and turns it into a clean, shareable HTML page — an artefact quick enough to skim so people don't have to read a whole transcript just to catch up on key happenings.

## 2. Requirements & Scope

Takes in transcripts, PPTs, PDFs as source input
- Auto-detects whether the content fits a specific format — timeline, gallery, or bubble map — but lets the user override if they want a different variation
- Flags if source material has internal TCS content that shouldn't be pasted into a general chat tool
