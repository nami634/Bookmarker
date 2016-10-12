const STORAGE = chrome.storage.local;const BOOKMARKS = chrome.bookmarks;const RUNTIME = chrome.runtime;const TABS = chrome.tabs;const WINDOWS = chrome.windows;const COMMANDS = chrome.commands;RUNTIME.onInstalled.addListener(function (detail) {  if (detail.reason == "install"){    initStorage().then(function (result) {      if (!result){        console.log('error!');        return false;      }      initFolder().then(function(result){        if(result){          initBookmarkData();        }      });    });  } else if(detail.reason == "update"){    var key_object;    key_object = {      bookmarks: false,      user_settings: false,      projects: false    };    STORAGE.get(key_object, function (result) {      if (!result["bookmarks"])result["bookmarks"] = {};      if (!result["projects"])result["projects"] = {};      if (!result["user_settings"])result["user_settings"] = {};      if (!result["user_settings"]["folders"])result["user_settings"]["folders"] = {};      if (!result["user_settings"]["max_results"])result["user_settings"]["max_results"] = 20;      STORAGE.set(result, function(){        for (let i = 1; i <= 3; i++) {          if (!result["user_settings"]["folders"][i]) {            initFolder();            break;          }        }      });    });  }});function initBookmarkData(){  let data = {};  data["bookmarks"] = {};  getBookmarkAll().then(function(bookmarks){    for (let i = 0; i < bookmarks.length; i++){      let bookmark = bookmarks[i];      data["bookmarks"][bookmark.id] = {};      data["bookmarks"][bookmark.id]["level"] = 3;      data["bookmarks"][bookmark.id]["scroll"] = 0;      data["bookmarks"][bookmark.id]["count"] = 0;    }    STORAGE.set(data);  });}function initStorage() {  return new Promise(function (resolve, reject) {    var data;    data = {      bookmarks: {},      user_settings: {        folders: {},        max_results: 20      },      projects: {        open_windows: {}      }    };    STORAGE.set(data, function () {      var error = RUNTIME.lastError;      if (error) reject(error);      resolve(true);    });  });}function initFolder() {  return new Promise(function (resolve, reject) {    let folder_ids = [];    BOOKMARKS.create({'title': 'Always'}, function (folder1) {      folder_ids.push(folder1.id);      BOOKMARKS.create({'title': 'See later'}, function (folder2) {        folder_ids.push(folder2.id);        BOOKMARKS.create({'title': 'Sometimes'}, function (folder3) {          folder_ids.push(folder3.id);          BOOKMARKS.create({'title': 'Projects'}, function (folder4) {            folder_ids.push(folder4.id);            setInitFolderId(folder_ids).then(function(result){              if (result) resolve(true);            });          });        });      });    });  });}function setInitFolderId(folder_ids) {  return new Promise(function (resolve) {    STORAGE.get("user_settings", function (user_settings) {      for (let i = 0; i < 4; i++) {        user_settings["user_settings"]["folders"][i + 1] = folder_ids[i];      }      STORAGE.set(user_settings, function () {        resolve(true);      })    });  });}COMMANDS.onCommand.addListener(function (command) {  if (command == "delete_bookmark"){    WINDOWS.getCurrent(function (window) {      TABS.getSelected(window.id, function (tab) {        getBookmarkAll().then(function (bookmarks) {          let bookmark = searchBookmarkUrl(bookmarks, tab.url);          if (!bookmark) return;          deleteBookmark(bookmark);        });      });    });  }});BOOKMARKS.onCreated.addListener(function (bookmark_id, bookmark) {  if (bookmark.children) {    let data = [];    data["bookmarks"] = {};    data["bookmarks"][bookmark_id] = {      "level": 3,      "scroll": 0,      "count": 0    };    STORAGE.set(data);  }});BOOKMARKS.onRemoved.addListener(function (bookmark_id) {  deleteStorage(bookmark_id);});WINDOWS.onRemoved.addListener(function (window_id) {  STORAGE.get("projects", function (data) {    if (!data["projects"]["open_windows"][window_id])return;    delete data["projects"]["open_windows"][window_id];    STORAGE.set(data);  });});RUNTIME.onMessage.addListener(  function(message, sender, sendResponse) {    if (message.get_bookmark_all) {      getBookmarkAll().then(function(result){        sortBookmarks(result).then(function (bookmarks) {          sendResponse({bookmarks: bookmarks});        });      });    }    if (message.bookmark_level){      setBookmarkLevel([message.bookmark_level.bookmark_id], [message.bookmark_level.level]).then(function(result){        sendResponse({result: result});      });      let key_object = {};      key_object["user_settings"] = {};      key_object["user_settings"]["folders"] = {};      key_object["user_settings"]["folders"][message.bookmark_level.level] = null;      STORAGE.get(key_object, function (folder) {        let folder_id = folder["user_settings"]["folders"][message.bookmark_level.level];        BOOKMARKS.move(message.bookmark_level.bookmark_id, {parentId: folder_id});      });    }    if (message.getBookmarkLevel){      getBookmarkLevel(message.getBookmarkLevel.bookmark_id).then(function(result){        sendResponse({result: result});      });    }    if (message.getStorage){      getStorage().then(function(result){        sendResponse({result: result});      });    }    if (message.newBookmark){      newBookmark(message.newBookmark.title, message.newBookmark.url, message.newBookmark.level, null).then(function (bookmark) {        setBookmarkLevel([bookmark.id], [level]).then(function (result) {          sendResponse(result);        });      });    }    if (message.getAllWindow){      getAllWindow().then(function (windows) {        sendResponse(windows);      });    }    if (message.closeTab != null){      closeTab(sender.url, message.closeTab);    }    if (message.openTab){      openTab(message.openTab).then(function (scroll) {        sendResponse(scroll);      });    }    if (message.newProject){      let name = message.newProject.name;      let windowId = message.newProject.windowId;      createProject(name).then(function (project_id) {        TABS.getAllInWindow(windowId, function (tabs) {          let bookmark_ids = [];          let functions = [];          let levels = [];          tabs.forEach(function (tab) {            if (tab.url == "chrome://newtab/")return;            let func = newBookmark(tab.title, tab.url, 4, project_id).then(function (bookmark) {              bookmark_ids.push(bookmark.id);            });            levels.push(4);            functions.push(func);          });          Promise.all(functions).then(function(resolve){            setBookmarkLevel(bookmark_ids, levels);          });          setProject(project_id, windowId);        });      });    }    if (message.getAllProject){      getProjectAll().then(function (projects) {        sendResponse(projects);        console.log(projects);;     });    }    if (message.openProject){      STORAGE.get("projects", function (data) {        let open_windows = data["projects"]["open_windows"];        if(!open_windows)return;        openProject(message.openProject.project_id);      });    }    return true;  });function openProject(project_id) {  BOOKMARKS.getChildren(project_id, function (bookmarks) {    let urls = [];    for (let i = 0; i < bookmarks.length; i++){      urls.push(bookmarks[i].url);    }    WINDOWS.create({url: urls, focused: true}, function (window) {      setProject(project_id, window.id);    });  });}function getProjectAll() {  return new Promise(function (resolve, reject) {    STORAGE.get("user_settings", function (data) {      let folder_id = data["user_settings"]["folders"][4];      if (!data)reject("error!");      BOOKMARKS.getChildren(folder_id, function (projects) {        for (let i = 0; i < projects.length; i++){          if (projects[i].url)projects.splice(i, 1);        }        resolve(projects);      });    });  });}function createProject(name) {  return new Promise(function (resolve) {    let data = {};    data["user_settings"] = {};    data["user_settings"]["folders"] = {};    STORAGE.get(data["user_settings"]["folders"][4], function (result) {      let folder_id = result["user_settings"]["folders"][4];      BOOKMARKS.create({parentId: folder_id, title: name}, function (project) {        resolve(project.id);      });    });  });}function setProject(project_id, window_id){  let data = {};  data["projects"] = {};  data["projects"]["open_windows"] = {};  data["projects"]["open_windows"][window_id] = project_id;  STORAGE.set(data);}function openTab(url) {  return new Promise(function (resolve, reject) {    getBookmarkAll().then(function (bookmark_all) {      let bookmark = searchBookmarkUrl(bookmark_all, url);      if (!bookmark) return;      let id = bookmark.id;      let key_object = {};      key_object["bookmarks"] = {};      key_object["bookmarks"][id] = null;      STORAGE.get(key_object, function (data) {        if (data["bookmarks"][id]["level"] == 2){          deleteBookmark(bookmark);        }        if (data["bookmarks"][id]["level"] == 2 || data["bookmarks"][id]["level"] == 3){          resolve(data["bookmarks"][id].scroll);        }else{          resolve(0);        }      });    });  });}function closeTab(url, scroll) {  getBookmarkAll().then(function (bookmark_all) {    let bookmark = searchBookmarkUrl(bookmark_all, url);    let id = bookmark.id;    let key_object = {};    key_object["bookmarks"] = {};    key_object["bookmarks"][id] = null;    STORAGE.get(key_object, function (data) {      if (!data["bookmarks"][id])data["bookmarks"][id] = {};      data["bookmarks"][id]["scroll"] = scroll;      data["bookmarks"][id]["count"] =  parseInt(data["bookmarks"][id]["count"]) + 1;      STORAGE.set(data);    });  });}function newBookmark(title, url, level, parent_id) {  return new Promise(function (resolve, reject) {    let key_object = {};    key_object["user_settings"] = {};    key_object["user_settings"]["folders"] = {};    key_object["user_settings"]["folders"][level] = null;    STORAGE.get(key_object, function (folder) {      parent_id = parent_id || folder["user_settings"]["folders"][level];      let bookmark_data = {        'title': title,        'url': url,        'parentId': parent_id      };      BOOKMARKS.create(bookmark_data, function (bookmark) {        if (!bookmark) reject('failed');        resolve(bookmark);      });    });  });}function deleteBookmark(bookmark) {  BOOKMARKS.remove(bookmark.id);}function getBookmarkAll(){  return new Promise(function(resolve, reject){    BOOKMARKS.getTree(function(desktop_bookmarks){      var result = [];      if (desktop_bookmarks){        createBookmarkArray(desktop_bookmarks, result);        resolve(result);      }else{        reject('failed');      }    });  });}function setBookmarkLevel(bookmark_ids, levels){  return new Promise(function(resolve, reject){    STORAGE.get("bookmarks", function (data) {      for (let i = 0; i < bookmark_ids.length; i++){        let bookmark_id = bookmark_ids[i];        let level = levels[i];        if (!data["bookmarks"][bookmark_id]) data["bookmarks"][bookmark_id] = {          "level": 3,          "scroll": 0,          "count": 0        };        data["bookmarks"][bookmark_id]["level"] = parseInt(level);      }      console.log(data);      STORAGE.set(data);    });  });}function getBookmarkLevel(bookmark_id){  return new Promise(function(resolve, reject){    let key_object = {};    key_object["bookmarks"] = {};    key_object["bookmarks"][bookmark_id] = null;    STORAGE.get(key_object, function(bookmark){      if(bookmark) resolve(bookmark.level);      reject("failed");    });  });}function getStorage(){  return new Promise(function(resolve,reject){    STORAGE.get(function(items){      resolve(items);    });  });}function deleteStorage(bookmark_id) {  STORAGE.get("bookmarks", function (data) {    Object.keys(data["bookmarks"]).forEach(function (key) {      if (key == bookmark_id){        delete data["bookmarks"][key];        return true;      }    });    STORAGE.set(data);  });}function getAllWindow() {  return new Promise(function (resolve) {    WINDOWS.getAll({populate: true}, function (windows) {      resolve(windows);    });  });}function createBookmarkArray(bookmarks, result){  result = result || [];  bookmarks.forEach(function (val) {    if(val.children){      createBookmarkArray(val.children, result);    } else if(val.url) {      val.bookmark = true;      result.push(val);    }  });}function sortBookmarks(bookmarks) {  return new Promise(function (resolve) {    getStorage().then(function (data) {      bookmarks.sort(function (a, b) {        if (!data["bookmarks"][a.id])return;        if (!data["bookmarks"][b.id])return;        let a_level = data["bookmarks"][a.id]["level"];        let b_level = data["bookmarks"][b.id]["level"];        let a_count = data["bookmarks"][a.id]["count"];        let b_count = data["bookmarks"][b.id]["count"];        if (a_level < b_level) return -1;        if (a_level > b_level) return 1;        if (a_count > b_count) return -1;        if (a_count < b_count) return 1;      });      resolve(bookmarks);    });  });}function searchBookmarkUrl(bookmarks, url) {  for (let i = 0; i < bookmarks.length; i++){    let val = bookmarks[i];    let result;    if(val.url == url){      result = val;    }    if(result) return result;  }  return false;}