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

  1. Extension will save and publish your file continously. This means that customizations will be immediately visible to everyone on your site, even while you create them. If some user visits the page you're customizing, and there's an error in your code at this moment, then instead of the list view or list form user will see an error message (only list view/form webpart will be broken, all other webparts on this page will function correctly). Thus I don't recommend using this tool directly on production yet. Create the customizations on dev or test environment, ensure they work, and only then push the finished JS file further to production (you'll have to attach it to the webpart via JSLink property, this can be done either manually or via Cisar).
  2. Files that are created are stored in Style Library. For now there's no way to change this.
  3. Library that hosts js files that are edited should have versioning (major+minor versions) and "require checkout" setting enabled for saving to work.
  4. If there're errors when saving and editing files, they're logged in the "Console" tab in Developer Tools, but not shown anywhere else.
  5. It is usually a good idea to disable caching ("Network" tab -> Disable cache checkbox).
  6. Display Templates and also CSWP customizations aren't supported yet.
