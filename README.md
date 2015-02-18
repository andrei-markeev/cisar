Cisar
=====

Google Chrome browser extension that adds a tab to Developer Tools, where you can create SharePoint Client Side Rendering customizations and they will be applied as-you-type to the underlying page.

![Screenshot](https://raw.github.com/andrei-markeev/cisar/master/screenshot.png)

Installing
----------
You can install the extension manually from the source code.

 1. Download the source code archive from GitHub and unpack it to some folder
 2. Check the "Developer mode" checkbox on the extensions page
 3. Click [Load unpacked extension...] button
 4. Select folder with the cisar source code

Using
-----
 1. Navigate to your SharePoint portal, to the page where you have list view or list form that you want to customize.
 2. Open Developer Tools window (F12).
 3. Switch to "Cisar" tab
 4. Click plus button in the left panel and create a file.
 5. Start writing customizations

Known problems and important notes
----------------------------------
Cisar is rather young. Below listed known bugs, inconveniences and notes. I'm working on improvements, but for now it is how it is:

  1. Files that are created are stored in Style Library. For now there's no way to change this.
  2. Library that hosts js files that are edited should have versioning (major+minor versions) and "require checkout" setting enabled for saving to work.
  3. If there're errors when saving and editing files, they're logged in the "Console" tab in Developer Tools, but not shown anywhere else.
  4. It is usually a good idea to disable caching ("Network" tab -> Disable cache checkbox).
  5. Display Templates and also CSWP customizations aren't supported yet.
