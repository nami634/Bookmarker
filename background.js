var storage = chrome.storage.local;chrome.runtime.onInstalled.addListener(function (detail) {  if (detail.reason == "install"){    initStorage().then(function (result) {      if (!result){        console.log('error!');        return false;      }      initFolder().then(function(result){        if(result){          initBookmarkData();        }      });    });  } else if(detail.reason == "update"){    var key_object;    key_object = {      bookmarks: false,      user_settings: false,      projects: false    };    storage.get(key_object, function (result) {      if (!result["bookmarks"])result["bookmarks"] = {};      if (!result["projects"])result["projects"] = {};      if (!result["user_settings"])result["user_settings"] = {};      if (!result["user_settings"]["folders"])result["user_settings"]["folders"] = {};      if (!result["user_settings"]["max_results"])result["user_settings"]["max_results"] = 20;      storage.set(result, function(){        for (let i = 1; i <= 3; i++) {          if (!result["user_settings"]["folders"][i]) {            initFolder();            break;          }        }      });    });  }});function initBookmarkData(){  let data = {};  data["bookmarks"] = {};  getBookmarkAll().then(function(bookmarks){    for (let i = 0; i < bookmarks.length; i++){      let bookmark = bookmarks[i];      data["bookmarks"][bookmark.id] = {};      data["bookmarks"][bookmark.id]["level"] = 3;      data["bookmarks"][bookmark.id]["scroll"] = 0;      data["bookmarks"][bookmark.id]["count"] = 0;    }    storage.set(data);  });}function initStorage() {  return new Promise(function (resolve, reject) {    var data;    data = {      bookmarks: {},      user_settings: {        folders: {},        max_results: 20      },      projects: {        open_windows: {}      }    };    storage.set(data, function () {      var error = chrome.runtime.lastError;      if (error) reject(error);      resolve(true);    });  });}function initFolder() {  return new Promise(function (resolve, reject) {    let folder_ids = [];    chrome.bookmarks.create({'title': 'Always'}, function (folder1) {      folder_ids.push(folder1.id);      chrome.bookmarks.create({'title': 'See later'}, function (folder2) {        folder_ids.push(folder2.id);        chrome.bookmarks.create({'title': 'Sometimes'}, function (folder3) {          folder_ids.push(folder3.id);          chrome.bookmarks.create({'title': 'Projects'}, function (folder4) {            folder_ids.push(folder4.id);            setInitFolderId(folder_ids).then(function(result){              if (result) resolve(true);            });          });        });      });    });  });}function setInitFolderId(folder_ids) {  return new Promise(function (resolve) {    storage.get("user_settings", function (user_settings) {      for (let i = 0; i < 4; i++) {        user_settings["user_settings"]["folders"][i + 1] = folder_ids[i];      }      storage.set(user_settings, function () {        resolve(true);      })    });  });}chrome.commands.onCommand.addListener(function (command) {  if (command == "delete_bookmark"){    chrome.windows.getCurrent(function (window) {      chrome.tabs.getSelected(window.id, function (tab) {        getBookmarkAll().then(function (bookmarks) {          let bookmark = searchBookmarkUrl(bookmarks, tab.url);          if (!bookmark) return;          deleteBookmark(bookmark);        });      });    });  }});chrome.bookmarks.onCreated.addListener(function (bookmark_id, bookmark) {  if (bookmark.children) {    let data = [];    data["bookmarks"] = {};    data["bookmarks"][bookmark_id] = {      "level": 3,      "scroll": 0,      "count": 0    };    storage.set(data);  }});chrome.bookmarks.onRemoved.addListener(function (bookmark_id) {  deleteStorage(bookmark_id);});chrome.windows.onRemoved.addListener(function (window_id) {  let data = {};  data["projects"] = {};  data["projects"]["open_windows"] = {};  storage.get(data["projects"]["open_windows"][window_id], function () {  });});chrome.runtime.onMessage.addListener(  function(message, sender, sendResponse) {    if (message.get_bookmark_all) {      getBookmarkAll().then(function(result){        sortBookmarks(result).then(function (bookmarks) {          sendResponse({bookmarks: bookmarks});        });      });    }    if (message.bookmark_level){      setBookmarkLevel([message.bookmark_level.bookmark_id], [message.bookmark_level.level]).then(function(result){        sendResponse({result: result});      });      let key_object = {};      key_object["user_settings"] = {};      key_object["user_settings"]["folders"] = {};      key_object["user_settings"]["folders"][message.bookmark_level.level] = null;      storage.get(key_object, function (folder) {        let folder_id = folder["user_settings"]["folders"][message.bookmark_level.level];        chrome.bookmarks.move(message.bookmark_level.bookmark_id, {parentId: folder_id});      });    }    if (message.getBookmarkLevel){      getBookmarkLevel(message.getBookmarkLevel.bookmark_id).then(function(result){        sendResponse({result: result});      });    }    if (message.getStorage){      getStorage().then(function(result){        sendResponse({result: result});      });    }    if (message.newBookmark){      newBookmark(message.newBookmark.title, message.newBookmark.url, message.newBookmark.level, null).then(function (bookmark) {        setBookmarkLevel([bookmark.id], [level]).then(function (result) {          sendResponse(result);        });      });    }    if (message.getAllWindow){      getAllWindow().then(function (windows) {        sendResponse(windows);      });    }    if (message.closeTab != null){      closeTab(sender.url, message.closeTab);    }    if (message.openTab){      openTab(message.openTab).then(function (scroll) {        sendResponse(scroll);      });    }    if (message.newProject){      let name = message.newProject.name;      let windowId = message.newProject.windowId;      createProject(name).then(function (project_id) {        chrome.tabs.getAllInWindow(windowId, function (tabs) {          let bookmark_ids = [];          let functions = [];          let levels = [];          tabs.forEach(function (tab) {            if (tab.url == "chrome://newtab/")return;            let func = newBookmark(tab.title, tab.url, 4, project_id).then(function (bookmark) {              bookmark_ids.push(bookmark.id);            });            levels.push(4);            functions.push(func);          });          Promise.all(functions).then(function(resolve){            setBookmarkLevel(bookmark_ids, levels);          });          setProject(project_id, windowId);        });      });    }    return true;  });function createProject(name) {  return new Promise(function (resolve) {    let data = {};    data["user_settings"] = {};    data["user_settings"]["folders"] = {};    storage.get(data["user_settings"]["folders"][4], function (result) {      let folder_id = result["user_settings"]["folders"][4];      chrome.bookmarks.create({parentId: folder_id, title: name}, function (project) {        resolve(project.id);      });    });  });}function setProject(project_id, window_id){  let data = {};  data["projects"] = {};  data["projects"]["open_windows"] = {};  data["projects"]["open_windows"][window_id] = project_id;  storage.set(data);}function openTab(url) {  return new Promise(function (resolve, reject) {    getBookmarkAll().then(function (bookmark_all) {      let bookmark = searchBookmarkUrl(bookmark_all, url);      if (!bookmark) return;      let id = bookmark.id;      let key_object = {};      key_object["bookmarks"] = {};      key_object["bookmarks"][id] = null;      storage.get(key_object, function (data) {        if (data["bookmarks"][id]["level"] == 2){          deleteBookmark(bookmark);        }        if (data["bookmarks"][id]["level"] == 2 || data["bookmarks"][id]["level"] == 3){          resolve(data["bookmarks"][id].scroll);        }else{          resolve(0);        }      });    });  });}function closeTab(url, scroll) {  getBookmarkAll().then(function (bookmark_all) {    let bookmark = searchBookmarkUrl(bookmark_all, url);    let id = bookmark.id;    let key_object = {};    key_object["bookmarks"] = {};    key_object["bookmarks"][id] = null;    storage.get(key_object, function (data) {      if (!data["bookmarks"][id])data["bookmarks"][id] = {};      data["bookmarks"][id]["scroll"] = scroll;      data["bookmarks"][id]["count"] =  parseInt(data["bookmarks"][id]["count"]) + 1;      storage.set(data);    });  });}function newBookmark(title, url, level, parent_id) {  return new Promise(function (resolve, reject) {    let key_object = {};    key_object["user_settings"] = {};    key_object["user_settings"]["folders"] = {};    key_object["user_settings"]["folders"][level] = null;    storage.get(key_object, function (folder) {      parent_id = parent_id || folder["user_settings"]["folders"][level];      let bookmark_data = {        'title': title,        'url': url,        'parentId': parent_id      };      chrome.bookmarks.create(bookmark_data, function (bookmark) {        if (!bookmark) reject('failed');        resolve(bookmark);      });    });  });}function deleteBookmark(bookmark) {  chrome.bookmarks.remove(bookmark.id);}function getBookmarkAll(){  return new Promise(function(resolve, reject){    chrome.bookmarks.getTree(function(desktop_bookmarks){      var result = [];      if (desktop_bookmarks){        createBookmarkArray(desktop_bookmarks, result);        resolve(result);      }else{        reject('failed');      }    });  });}function setBookmarkLevel(bookmark_ids, levels){  return new Promise(function(resolve, reject){    storage.get("bookmarks", function (data) {      for (let i = 0; i < bookmark_ids.length; i++){        let bookmark_id = bookmark_ids[i];        let level = levels[i];        if (!data["bookmarks"][bookmark_id]) data["bookmarks"][bookmark_id] = {          "level": 3,          "scroll": 0,          "count": 0        };        data["bookmarks"][bookmark_id]["level"] = parseInt(level);      }      console.log(data);      storage.set(data);    });  });}function getBookmarkLevel(bookmark_id){  return new Promise(function(resolve, reject){    let key_object = {};    key_object["bookmarks"] = {};    key_object["bookmarks"][bookmark_id] = null;    storage.get(key_object, function(bookmark){      if(bookmark) resolve(bookmark.level);      reject("failed");    });  });}function getStorage(){  return new Promise(function(resolve,reject){    storage.get(function(items){      resolve(items);    });  });}function deleteStorage(bookmark_id) {  storage.get("bookmarks", function (data) {    Object.keys(data["bookmarks"]).forEach(function (key) {      if (key == bookmark_id){        delete data["bookmarks"][key];        return true;      }    });    storage.set(data);  });}function getAllWindow() {  return new Promise(function (resolve) {    chrome.windows.getAll({populate: true}, function (windows) {      resolve(windows);    });  });}function createBookmarkArray(bookmarks, result){  result = result || [];  bookmarks.forEach(function (val) {    if(val.children){      createBookmarkArray(val.children, result);    } else if(val.url) {      val.bookmark = true;      result.push(val);    }  });}function sortBookmarks(bookmarks) {  return new Promise(function (resolve) {    getStorage().then(function (data) {      bookmarks.sort(function (a, b) {        if (!data["bookmarks"][a.id])return;        if (!data["bookmarks"][b.id])return;        let a_level = data["bookmarks"][a.id]["level"];        let b_level = data["bookmarks"][b.id]["level"];        let a_count = data["bookmarks"][a.id]["count"];        let b_count = data["bookmarks"][b.id]["count"];        if (a_level < b_level) return -1;        if (a_level > b_level) return 1;        if (a_count > b_count) return -1;        if (a_count < b_count) return 1;      });      resolve(bookmarks);    });  });}function searchBookmarkUrl(bookmarks, url) {  for (let i = 0; i < bookmarks.length; i++){    let val = bookmarks[i];    let result;    if(val.url == url){      result = val;    }    if(result) return result;  }  return false;}