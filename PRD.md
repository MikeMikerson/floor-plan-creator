### **Product Requirements Document: MoveWise Mobile Application**

**Document Version:** 1.0
**Status:** Draft
**Author:** Product Management
**Date:** 2025-09-25

### 1. Introduction & Vision

Moving is a universally stressful experience, characterized by logistical complexity, tight deadlines, and the anxiety of uncertainty. Users struggle to track critical tasks and visualize how their belongings will fit into a new, unfamiliar space. The MoveWise mobile application is designed to be the essential companion for anyone undergoing a residential move. It aims to reduce stress and empower users by providing simple, powerful tools for organization and spatial planning, all within a single, intuitive interface. Our vision is to transform the chaos of moving into a controlled, manageable, and even enjoyable process.

### 2. Product Goals & Objectives

* **Primary Goal:** To simplify the residential moving process by centralizing task management and home layout planning.
* **Key Objectives:**
* Provide users with a clear, chronological view of their moving-related tasks and deadlines.
* Enable users to create a digital inventory of their furniture with precise dimensions.
* Deliver an intuitive, 2D floor plan designer that allows users to visualize their new home layout before they move.
* Drive organic user acquisition through a built-in, value-driven social sharing feature.

### 3. Target Audience & User Personas

**Primary Persona: "The Proactive Planner"**

* **Demographics:** 25-45 years old, tech-savvy, planning a move within the next 1-6 months.
* **Behaviors:** Uses apps for organization (calendars, to-do lists). They are likely renting or buying a new home and have a floor plan available from a real estate listing or landlord.
* **Needs & Pain Points:**
* Needs a single source of truth for moving dates and deadlines.
* Worries about whether their existing furniture will fit in the new space.
* Feels overwhelmed by the number of small decisions and tasks involved in a move.
* Wants to feel in control and prepared for moving day.

### 4. Functional Requirements & User Stories

#### 4.1. Feature: My Move Timeline

This feature serves as the organizational hub for the user's moving schedule.

* **USER STORY 4.1.1:** As a user, I want to add important events and deadlines with custom names and dates to a timeline, so that I can track all my critical moving-related tasks in one place.
* **USER STORY 4.1.2:** As a user, I want to see my events displayed chronologically, so I can easily understand what I need to do next.
* **USER STORY 4.1.3:** As a user, I want to be able to delete or edit events on my timeline, so I can adapt to changing plans.

#### 4.2. Feature: Furniture Inventory

This feature allows users to catalog their furniture and its dimensions, which will be used in the layout designer.

* **USER STORY 4.2.1:** As a user, I want to create a digital list of my furniture items, so I have a complete inventory.
* **USER STORY 4.2.2:** As a user, I want to add a new furniture item by specifying its name (e.g., "Sofa"), dimensions (width and length), and assigning it to a room category (e.g., "Living Room," "Bedroom").
* **USER STORY 4.2.3:** As a user, I want my furniture inventory to be organized into collapsible lists based on the room category I assigned, so I can easily find items for a specific room.
* **USER STORY 4.2.4:** As a user, I want to edit the name, dimensions, or room category of any furniture item in my list at any time, so my inventory remains accurate.
* **USER STORY 4.2.5:** As a user, I want to delete furniture items from my list that I no longer own or plan to move.

#### 4.3. Feature: My Home Layout Designer

This is the core visualization feature of the application. It allows users to place their inventoried furniture onto their new home's floor plan.

* **USER STORY 4.3.1:** As a user, I want to start a new layout design by uploading an image of a floor plan from my device's photo library.

* **USER STORY 4.3.2:** As a user, upon uploading a floor plan, I want to be prompted to set the scale of the drawing by selecting a reference object (e.g., "Standard Door," "Queen Bed") and resizing it to match the corresponding object on my uploaded floor plan image.
* **Requirement 4.3.2.a: Scale Calculation:** The application must calculate a single scale factor (e.g., pixels per inch) based on this reference action. This factor will govern the size of all subsequent furniture objects placed on the canvas. The calculation is as follows:
Let $D_{real}$ be the known real-world dimension of the reference object (e.g., a standard door is 36 inches).
Let $D_{pixels}$ be the dimension in pixels that the user sets by resizing the reference object on the screen.
The scale factor $S$ for the canvas is calculated as $S = D_{real} / D_{pixels}$.
For any furniture item with a real-world dimension $F_{real}$, its dimension on the canvas $F_{pixels}$ will be $F_{pixels} = F_{real} / S$.

* **USER STORY 4.3.3:** As a user, once the scale is set, I want to access my Furniture Inventory from a drawer or side panel, organized by room category.

* **USER STORY 4.3.4:** As a user, I want to drag furniture items from my inventory and drop them onto the floor plan canvas. The dropped item must appear as a basic rectangular shape, rendered to the correct proportional size based on the established scale.

* **USER STORY 4.3.5:** As a user, I want to be able to rotate and move the furniture objects anywhere on the canvas after they have been placed.

* **USER STORY 4.3.6:** As a user, I expect that I cannot resize a furniture object on the canvas, because its dimensions are predetermined and fixed in my inventory.

* **USER STORY 4.3.7:** As a user, I want furniture objects to be color-coded based on their room category (e.g., all "Living Room" items are blue, all "Bedroom" items are green), so I can visually distinguish between room groupings.

* **USER STORY 4.3.8:** As a user, I want to be visually alerted when two furniture objects from the same room category are touching or overlapping by having both objects change their color to red, so I can identify potential collisions and spacing issues.

* **USER STORY 4.3.9:** As a user, I want the state of my layout (uploaded image, scale, and all furniture positions) to be saved automatically when I close the app, so I can resume my planning later without losing progress.

* **USER STORY 4.3.10:** As a user, I want a button to completely reset the layout, which prompts me with a confirmation dialog ("Are you sure you want to clear the entire layout?") before deleting my work.

#### 4.4. Feature: Export & Social Sharing

This feature
drives engagement and user acquisition.

* **USER STORY 4.4.1:** As a user, I want an "Export" or "Share" button within the layout designer that generates a clean screenshot of my current floor plan with the furniture I have placed.
* **USER STORY 4.4.2:** As a user, upon tapping "Share," I want to be presented with my device's native sharing options (e.g., Messages, LINE, Instagram, Facebook).
* **USER STORY 4.4.3:** As a user, I want the shared post to automatically include a promotional message, such as "I planned my new home layout with the MoveWise app! Download it here: [AppStore/PlayStore Link]", so I can easily tell my friends what tool I used.

### 5. Non-Functional Requirements

* **Performance:** The drag-and-drop interface must be smooth and responsive, with no discernible lag, even with 20+ objects on the canvas. App launch time should be under 2 seconds.
* **Usability:** The user interface must be clean, intuitive, and require minimal instruction. Key actions like adding furniture and setting the scale must be guided.
* **Compatibility:** The application must be fully functional on the latest two major versions of iOS and Android.
* **Persistence:** All user-generated data (timeline events, furniture inventory, layout state) must be stored locally on the device.

### 6. Out of Scope (Future Considerations)

The following features will not be included in the initial release but may be considered for future versions:

* 3D visualization of layouts.
* Cloud synchronization of user data across multiple devices.
* Pre-populated libraries of common furniture items and dimensions.
* Integration with professional moving services or storage companies.
* Cost estimation tools for moving.
* Checklist templates for packing.
