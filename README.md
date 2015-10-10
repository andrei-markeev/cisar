Cisar
=====

Google Chrome browser extension that adds a tab to Developer Tools, where you can create SharePoint Client Side Rendering customizations and they will be applied as-you-type to the underlying page.

![How it works](https://raw.github.com/andrei-markeev/cisar/master/cisar.gif)

Installing
----------
Extension is available [on Chrome WebStore](https://chrome.google.com/webstore/detail/cisar/nifbdojdggkboiifaklkamfpjcmgafpo).

Alternatively, you can install it manually from the source code:

 1. Download the source code archive from GitHub and unpack it to some folder
 2. Check the "Developer mode" checkbox on the extensions page
 3. Click [Load unpacked extension...] button
 4. Select folder with the Cisar source code

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

  1. If there're errors when saving files, they're logged in the "Console" tab in Developer Tools, but not shown anywhere else.
  2. It is usually a very good idea to disable caching ("Network" tab -> Disable cache checkbox).
  3. Display Templates and also CSWP customizations aren't supported yet.
