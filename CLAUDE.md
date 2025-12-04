# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 project for a Mekong Fish Dashboard, built with the App Router architecture. The project uses Turbopack for faster development builds and includes Material-UI for components, Firebase for backend services, and Recharts for data visualization.

## Development Commands

- `npm run dev`: Start development server with Turbopack
- `npm run build`: Build production version with Turbopack  
- `npm start`: Start production server
- `npm run lint`: Run ESLint for code quality checks

## Key Dependencies

- **UI Framework**: Material-UI (@mui/material, @mui/icons-material)
- **Styling**: Emotion (@emotion/react, @emotion/styled)
- **Forms**: React Hook Form (react-hook-form)
- **Charts**: Recharts
- **Backend**: Firebase
- **Utilities**: date-fns for date manipulation

## Project Structure

- `src/app/`: Next.js App Router directory
  - `layout.js`: Root layout with Geist font configuration
  - `page.js`: Homepage component
  - `globals.css`: Global styles
- `public/`: Static assets (SVG icons, images)
- `jsconfig.json`: Configured with `@/*` path alias pointing to `src/*`

## Architecture Notes

- Uses Next.js App Router (not Pages Router)
- Turbopack enabled for both dev and build for improved performance
- Font optimization with Geist Sans and Geist Mono from next/font/google
- ESLint configured with Next.js core web vitals rules
- Path aliases configured (`@/*` maps to `src/*`)

## Firebase Integration

The project includes Firebase as a dependency, suggesting integration for:
- Authentication
- Database (Firestore)
- Real-time data updates for fish dashboard

## Data Visualization

Recharts is included for creating charts and graphs, likely for:
- Fish population data
- Environmental metrics
- Historical trends