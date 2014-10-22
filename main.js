(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*
 * Q-municate chat application
 *
 * Main Module
 *
 */

var APP;

// includes
var User = require('./models/user'),
    Session = require('./models/session'),
    Contact = require('./models/contact'),
    Dialog = require('./models/dialog'),
    Message = require('./models/message'),
    Attach = require('./models/attach'),
    ContactList = require('./models/contact_list'),
    UserView = require('./views/user'),
    DialogView = require('./views/dialog'),
    MessageView = require('./views/message'),
    AttachView = require('./views/attach'),
    ContactListView = require('./views/contact_list'),
    Routes = require('./routes'),
    QBApiCalls = require('./qbApiCalls');

function QM() {
  this.models = {
    User: new User(this),
    Session: new Session(this),
    Contact: new Contact(this),
    Dialog: new Dialog(this),
    Message: new Message(this),
    Attach: new Attach(this),
    ContactList: new ContactList(this)
  };

  this.views = {
    User: new UserView(this),
    Dialog: new DialogView(this),
    Message: new MessageView(this),
    Attach: new AttachView(this),
    ContactList: new ContactListView(this)
  };

  this.routes = new Routes(this);
  this.service = new QBApiCalls(this);
}

QM.prototype = {
  init: function() {
    var token;

    this.chromaHash();
    this.setHtml5Patterns();

    // QB SDK initialization
    // Checking if autologin was chosen
    if (localStorage['QM.session'] && localStorage['QM.user'] &&
        // new format of storage data (20.07.2014)
        JSON.parse(localStorage['QM.user']).user_jid) {
      
      token = JSON.parse(localStorage['QM.session']).token;
      this.service.init(token);

    } else {
      this.service.init();
    }

    this.routes.init();

    if (QMCONFIG.debug) console.log('App init', this);
  },

  chromaHash: function() {
    new ChromaHash({
      visualization: 'bars'
    });
  },

  setHtml5Patterns: function() {
    $('.pattern-name').attr('pattern', QMCONFIG.patterns.name);
    $('.pattern-pass').attr('pattern', QMCONFIG.patterns.password);
  }
};

// Application initialization
$(document).ready(function() {
  $.ajaxSetup({ cache: true });
  $.getScript('https://connect.facebook.net/en_US/sdk.js', function() {
    FB.init({
      appId: QMCONFIG.fbAccount.appId,
      version: 'v2.0'
    });
    if (QMCONFIG.debug) console.log('FB init', FB);

    // emoji smiles run
    $('.smiles-group').each(function() {
      var obj = $(this);
      obj.html(minEmoji(obj.text()));
    });

    APP = new QM;
    APP.init();
  });
});

// FB SDK initialization
// window.fbAsyncInit = function() {
//   var view = APP.views.User;

//   FB.init({
//     appId: QMCONFIG.fbAccount.appId,
//     version: 'v2.0'
//   });
//   if (QMCONFIG.debug) console.log('FB init', FB);

//   // If you called the getFBStatus function before FB.init
//   // Continue it again
//   if (sessionStorage['QM.is_getFBStatus']) {
//     sessionStorage.removeItem('QM.is_getFBStatus');
//     view.getFBStatus();
//   }
// };

// Leave a chat after closing window
// window.onbeforeunload = function() {
//   QB.chat.sendPres('unavailable');
// };

window.offLineHandler = function() {
  $('.no-connection').removeClass('is-hidden');
};

window.onLineHandler = function() {
  $('.no-connection').addClass('is-hidden');
};

},{"./models/attach":2,"./models/contact":3,"./models/contact_list":4,"./models/dialog":5,"./models/message":6,"./models/session":7,"./models/user":8,"./qbApiCalls":9,"./routes":10,"./views/attach":11,"./views/contact_list":12,"./views/dialog":13,"./views/message":14,"./views/user":15}],2:[function(require,module,exports){
/*
 * Q-municate chat application
 *
 * Attach Module
 *
 */

module.exports = Attach;

function Attach(app) {
  this.app = app;
}

Attach.prototype = {

  upload: function(file, callback) {
    var QBApiCalls = this.app.service,
        self = this;

    QBApiCalls.createBlob({file: file, 'public': true}, function(blob) {
      callback(blob);
    });
  },

  create: function(blob, size) {
    return {
      id: blob.id,
      type: blob.content_type,
      name: blob.name,
      size: size,
      url: blob.path,
      uid: blob.uid
    };
  },

  crop: function(file, params, callback) {
    loadImage(
      file,
      function (img) {
        var attr = {crop: true};
        if (img.width > img.height)
          attr.maxWidth = params.w;
        else
          attr.maxHeight = params.h;
        
        loadImage(
          file,
          function (canvas) {
            canvas.toBlob(function(blob) {
              blob.name = file.name;
              callback(blob);
            }, file.type);
          },
          attr
        );
      }
    );
  }

};

},{}],3:[function(require,module,exports){
/*
 * Q-municate chat application
 *
 * Contact Module
 *
 */

module.exports = Contact;

function Contact(app) {
  this.app = app;
}

Contact.prototype = {

  create: function(qbUser) {
    return {
      id: qbUser.id,
      facebook_id: qbUser.facebook_id,
      full_name: qbUser.full_name,
      email: qbUser.email,
      blob_id: qbUser.blob_id,
      avatar_url: qbUser.avatar_url || getAvatar(qbUser),
      status: qbUser.status || getStatus(qbUser),
      tag: qbUser.tag || qbUser.user_tags || null,
      user_jid: qbUser.user_jid || QB.chat.helpers.getUserJid(qbUser.id, QMCONFIG.qbAccount.appId)
    };
  }

};

/* Private
---------------------------------------------------------------------- */
function getAvatar(contact) {
  var avatar;

  if (contact.blob_id) {
    try {
      avatar = JSON.parse(contact.custom_data).avatar_url;
    } catch(err) {
      // contact.website - temporary storage of avatar url for mobile apps (14.07.2014)
      avatar = contact.website;
    }
  } else {
    if (contact.facebook_id) {
      avatar = 'https://graph.facebook.com/' + contact.facebook_id + '/picture?width=146&height=146';
    } else {
      avatar = QMCONFIG.defAvatar.url;
    }
  }

  return avatar;
}

function getStatus(contact) {
  var status;
  
  try {
    status = JSON.parse(contact.custom_data).status || null;
  } catch(err) {
    // contact.custom_data - temporary storage of status message for mobile apps (14.07.2014)
    status = contact.custom_data || null;
  }

  return status;
}

},{}],4:[function(require,module,exports){
/*
 * Q-municate chat application
 *
 * Contact List Module
 *
 */

module.exports = ContactList;

var contact_ids;

function ContactList(app) {
  this.app = app;
  this.roster = {};
  this.contacts = getContacts();
  this.dialogs = {};
  contact_ids = Object.keys(this.contacts).map(Number);
}

ContactList.prototype = {

  saveRoster: function(roster) {
    // sessionStorage.setItem('QM.roster', JSON.stringify(roster));
    this.roster = roster;
  },

  saveNotConfirmed: function(notConfirmed) {
    localStorage.setItem('QM.notConfirmed', JSON.stringify(notConfirmed));
  },

  saveHiddenDialogs: function(hiddenDialogs) {
    sessionStorage.setItem('QM.hiddenDialogs', JSON.stringify(hiddenDialogs));
  },

  add: function(occupants_ids, dialog, callback, subscribe) {
    var QBApiCalls = this.app.service,
        Contact = this.app.models.Contact,
        self = this,
        new_ids,
        params;

    // TODO: need to make optimization here
    // (for new device the user will be waiting very long time if he has a lot of private dialogs)
    new_ids = [].concat(_.difference(occupants_ids, contact_ids));
    contact_ids = contact_ids.concat(new_ids);
    localStorage.setItem('QM.contacts', contact_ids.join());
    if (subscribe) new_ids = occupants_ids;

    if (new_ids.length > 0) {
      params = { filter: { field: 'id', param: 'in', value: new_ids }, per_page: 100 };

      QBApiCalls.listUsers(params, function(users) {
        users.items.forEach(function(qbUser) {
          var user = qbUser.user;
          var contact = Contact.create(user);
          self.contacts[user.id] = contact;
          localStorage.setItem('QM.contact-' + user.id, JSON.stringify(contact));
        });

        if (QMCONFIG.debug) console.log('Contact List is updated', self);
        callback(dialog);
      });
      
    } else {
      callback(dialog);
    }
  },

  globalSearch: function(callback) {
    var QBApiCalls = this.app.service,
        val = sessionStorage['QM.search.value'],
        page = sessionStorage['QM.search.page'],
        self = this,
        contacts;
    
    QBApiCalls.getUser({full_name: val, page: page}, function(data) {
      sessionStorage.setItem('QM.search.allPages', Math.ceil(data.total_entries / data.per_page));
      sessionStorage.setItem('QM.search.page', ++page);
      
      contacts = self.getResults(data.items);
      if (QMCONFIG.debug) console.log('Search results', contacts);

      callback(contacts);
    });
  },

  getResults: function(data) {
    var Contact = this.app.models.Contact,
        User = this.app.models.User,
        self = this,
        contacts = [],
        contact;
    
    data.forEach(function(item) {
      if (item.user.id !== User.contact.id) {
        contact = Contact.create(item.user);
        contacts.push(contact);
      }
    });
    return contacts;
  },

  getFBFriends: function(ids, callback) {
    var QBApiCalls = this.app.service,
        Contact = this.app.models.Contact,
        self = this,
        new_ids = [],
        params;

    // TODO: duplicate of add() function
    params = { filter: { field: 'facebook_id', param: 'in', value: ids } };

    QBApiCalls.listUsers(params, function(users) {
      users.items.forEach(function(qbUser) {
        var user = qbUser.user;
        var contact = Contact.create(user);
        new_ids.push(user.id);
        self.contacts[user.id] = contact;
        localStorage.setItem('QM.contact-' + user.id, JSON.stringify(contact));
      });

      contact_ids = contact_ids.concat(new_ids);
      localStorage.setItem('QM.contacts', contact_ids.join());

      if (QMCONFIG.debug) console.log('Contact List is updated', self);
      callback(new_ids);
    });
  }

};

/* Private
---------------------------------------------------------------------- */
// Creation of Contact List from cache
function getContacts() {
  var contacts = {},
      ids = localStorage['QM.contacts'] ? localStorage['QM.contacts'].split(',') : [];

  if (ids.length > 0) {
    try {
      for (var i = 0, len = ids.length; i < len; i++) {
        contacts[ids[i]] = typeof localStorage['QM.contact-' + ids[i]] !== 'undefined' ?
                           JSON.parse(localStorage['QM.contact-' + ids[i]]) :
                           true;

        if (contacts[ids[i]] === true) delete contacts[ids[i]];
      }
    } catch(e) {
      console.log("Error getting contacts from cache. Clearing...");
      localStorage.clear();
      contacts = {};
    }
  }

  return contacts;
}

},{}],5:[function(require,module,exports){
/*
 * Q-municate chat application
 *
 * Dialog Module
 *
 */

module.exports = Dialog;

function Dialog(app) {
  this.app = app;
}

Dialog.prototype = {

  download: function(callback) {
    var QBApiCalls = this.app.service;

    QBApiCalls.listDialogs({sort_desc: 'last_message_date_sent'}, function(dialogs) {
      callback(dialogs);
    });
  },

  create: function(params) {
    var User = this.app.models.User,
        // exclude current user from dialog occupants that he doesn't hit to yourself in Contact List
        occupants_ids = _.without(params.occupants_ids, User.contact.id);

    return {
      id: params._id,
      type: params.type,
      room_jid: params.xmpp_room_jid || null,
      room_name: params.name || null,
      room_photo: params.photo || null,
      occupants_ids: occupants_ids,
      last_message_date_sent: params.last_message_date_sent || null,
      unread_count: params.unread_messages_count || ''
    };
  },

  createPrivate: function(jid, isNew) {
    var QBApiCalls = this.app.service,
        DialogView = this.app.views.Dialog,        
        ContactList = this.app.models.ContactList,
        User = this.app.models.User,
        id = QB.chat.helpers.getIdFromNode(jid),
        self = this,
        dialog;

    QBApiCalls.createDialog({type: 3, occupants_ids: id}, function(res) {
      dialog = self.create(res);
      ContactList.dialogs[dialog.id] = dialog;
      if (QMCONFIG.debug) console.log('Dialog', dialog);

      if (!localStorage['QM.dialog-' + dialog.id]) {
        localStorage.setItem('QM.dialog-' + dialog.id, JSON.stringify({ messages: [] }));
      }

      // send notification about subscribe
      QB.chat.send(jid, {type: 'chat', extension: {
        save_to_history: 1,
        dialog_id: dialog.id,
        date_sent: Math.floor(Date.now() / 1000),

        notification_type: '3',
        full_name: User.contact.full_name,
      }});

      ContactList.add(dialog.occupants_ids, null, function() {
        DialogView.addDialogItem(dialog, null, isNew);
      });
    });
  },

  createGroup: function(occupants_names, params, callback) {
    var QBApiCalls = this.app.service,
        DialogView = this.app.views.Dialog,        
        ContactList = this.app.models.ContactList,
        contacts = ContactList.contacts,
        User = this.app.models.User,
        self = this,
        dialog;

    QBApiCalls.createDialog(params, function(res) {
      dialog = self.create(res);
      ContactList.dialogs[dialog.id] = dialog;
      if (QMCONFIG.debug) console.log('Dialog', dialog);

      if (!localStorage['QM.dialog-' + dialog.id]) {
        localStorage.setItem('QM.dialog-' + dialog.id, JSON.stringify({ messages: [] }));
      }

      QB.chat.muc.join(dialog.room_jid, function() {
        var msgId = QB.chat.helpers.getBsonObjectId();
        
        QB.chat.addListener({name: 'message', type: 'groupchat', id: msgId}, function() {
          DialogView.addDialogItem(dialog);
          callback(dialog);

          // send notifications about adding people
          for (var i = 0, len = dialog.occupants_ids.length, id; i < len; i++) {
            id = dialog.occupants_ids[i];
            QB.chat.send(contacts[id].user_jid, {type: 'chat', extension: {
              dialog_id: dialog.id,
              date_sent: Math.floor(Date.now() / 1000),

              notification_type: '1',
              full_name: User.contact.full_name,
              room_jid: dialog.room_jid,
              room_name: dialog.room_name,
              occupants_ids: res.occupants_ids.join()
            }});
          }
        });

        // send notification about creating room
        QB.chat.send(dialog.room_jid, {id: msgId, type: 'groupchat', body: occupants_names, extension: {
          save_to_history: 1,
          dialog_id: dialog.id,
          date_sent: Math.floor(Date.now() / 1000),

          notification_type: '1',
          full_name: User.contact.full_name
        }});
        
      });

    });
  },

  updateGroup: function(occupants_names, params, callback) {
    var QBApiCalls = this.app.service,
        DialogView = this.app.views.Dialog,
        ContactList = this.app.models.ContactList,
        contacts = ContactList.contacts,
        User = this.app.models.User,
        self = this,
        dialog;

    QBApiCalls.updateDialog(params.dialog_id, {push_all: {occupants_ids: [params.occupants_ids]}}, function(res) {
      dialog = self.create(res);
      ContactList.dialogs[params.dialog_id] = dialog;
      if (QMCONFIG.debug) console.log('Dialog', dialog);

      var msgId = QB.chat.helpers.getBsonObjectId();
      
      QB.chat.addListener({name: 'message', type: 'groupchat', id: msgId}, function() {
        callback(dialog);

        // send notifications about adding people
        for (var i = 0, len = params.new_ids.length, id; i < len; i++) {
          id = params.new_ids[i];
          QB.chat.send(contacts[id].user_jid, {type: 'chat', extension: {
            dialog_id: dialog.id,
            date_sent: Math.floor(Date.now() / 1000),

            notification_type: '1',
            full_name: User.contact.full_name,
            room_jid: dialog.room_jid,
            room_name: dialog.room_name,
            occupants_ids: res.occupants_ids.join()
          }});
        }
      });

      // send notification about updating room
      QB.chat.send(dialog.room_jid, {id: msgId, type: 'groupchat', body: occupants_names, extension: {
        save_to_history: 1,
        dialog_id: dialog.id,
        date_sent: Math.floor(Date.now() / 1000),

        notification_type: '2',
        occupants_ids: params.new_ids.join(),
      }});

    });
  },

  changeName: function(dialog_id, name) {
    var QBApiCalls = this.app.service,
        ContactList = this.app.models.ContactList,
        self = this,
        dialog;

    QBApiCalls.updateDialog(dialog_id, {name: name}, function(res) {
      dialog = self.create(res);
      ContactList.dialogs[dialog_id] = dialog;
      if (QMCONFIG.debug) console.log('Dialog', dialog);

      // send notification about updating room
      QB.chat.send(dialog.room_jid, {type: 'groupchat', extension: {
        save_to_history: 1,
        dialog_id: dialog.id,
        date_sent: Math.floor(Date.now() / 1000),

        notification_type: '2',
        room_name: name,
      }});
    });
  },

  changeAvatar: function(dialog_id, objDom, callback) {
    var QBApiCalls = this.app.service,
        ContactList = this.app.models.ContactList,
        Attach = this.app.models.Attach,
        file = objDom[0].files[0] || null,
        self = this,
        errMsg, dialog;

    if (file) {
      if (file.type.indexOf('image/') === -1)
        errMsg = QMCONFIG.errors.avatarType;
      else if (file.name.length > 100)
        errMsg = QMCONFIG.errors.fileName;

      if (errMsg) {
        console.log(errMsg);
        callback(false);
      } else {

        Attach.crop(file, {w: 40, h: 40}, function(avatar) {
          Attach.upload(avatar, function(blob) {
            QBApiCalls.updateDialog(dialog_id, {photo: blob.path}, function(res) {
              dialog = self.create(res);
              ContactList.dialogs[dialog_id] = dialog;
              if (QMCONFIG.debug) console.log('Dialog', dialog);

              // send notification about updating room
              QB.chat.send(dialog.room_jid, {type: 'groupchat', extension: {
                save_to_history: 1,
                dialog_id: dialog.id,
                date_sent: Math.floor(Date.now() / 1000),

                notification_type: '2',
                room_photo: blob.path,
              }});

              callback(blob.path);
            });
          });
        });

      }      
    } else {
      callback(false);
    }
  },

  leaveChat: function(dialog, callback) {
    var QBApiCalls = this.app.service,
        User = this.app.models.User,
        self = this;

    // send notification about leave
    QB.chat.send(dialog.room_jid, {type: 'groupchat', extension: {
      save_to_history: 1,
      dialog_id: dialog.id,
      date_sent: Math.floor(Date.now() / 1000),

      notification_type: '2',
      deleted_id: User.contact.id
    }});

    QBApiCalls.updateDialog(dialog.id, {pull_all: {occupants_ids: [User.contact.id]}}, function() {
      // QB.chat.muc.leave(dialog.room_jid, function() {});
    });
    
    callback();
  }

};

},{}],6:[function(require,module,exports){
/*
 * Q-municate chat application
 *
 * Message Module
 *
 */

module.exports = Message;

function Message(app) {
  this.app = app;
  this.skip = {};
}

Message.prototype = {

  download: function(dialog_id, callback, count) {
    var QBApiCalls = this.app.service,
        self = this;

    if (self.skip[dialog_id] && self.skip[dialog_id] === count) return false;

    QBApiCalls.listMessages({chat_dialog_id: dialog_id, sort_desc: 'date_sent', limit: 50, skip: count || 0}, function(messages) {
      callback(messages);
      self.skip[dialog_id] = count;
    });
  },

  create: function(params) {
    var User = this.app.models.User,
        message;

    message = {
      id: (params.extension && params.extension.message_id) || params._id || null,
      dialog_id: (params.extension && params.extension.dialog_id) || params.chat_dialog_id,
      body: params.body || params.message || null,
      notification_type: (params.extension && params.extension.notification_type) || params.notification_type || null,
      date_sent: (params.extension && params.extension.date_sent) || params.date_sent,
      read: params.read || false,
      attachment: (params.extension && params.extension.attachments && params.extension.attachments[0]) || (params.attachments && params.attachments[0]) || params.attachment || null,
      sender_id: params.sender_id || null,
      recipient_id: params.recipient_id || null,
      occupants_ids: (params.extension && params.extension.occupants_ids) || params.occupants_ids || null,
      room_name: (params.extension && params.extension.room_name) || params.room_name || null,
      room_photo: (params.extension && params.extension.room_photo) || params.room_photo || null,
      deleted_id: (params.extension && params.extension.deleted_id) || params.deleted_id || null
    };

    if (message.attachment) {
      message.attachment.id = parseInt(message.attachment.id);
      message.attachment.size = parseInt(message.attachment.size);
    }

    return message;
  },

  update: function(message_id, dialog_id) {
    var QBApiCalls = this.app.service;

    QBApiCalls.updateMessage(message_id, {chat_dialog_id: dialog_id, read: 1}, function() {
      
    });
  }

};

},{}],7:[function(require,module,exports){
/*
 * Q-municate chat application
 *
 * Session Module
 *
 */

module.exports = Session;

function Session(app) {
  this.app = app;
  this._remember = false;
}

Session.prototype = {

  create: function(params, isRemember) {
    this.token = params.token;
    this.expirationTime = params.expirationTime || null;
    this.authParams = params.authParams;
    this._remember = isRemember || false;
  },

  update: function(params) {
    var storage, date;

    if (params.token) {
      this.token = params.token;
    } else {
      
      if (params.authParams) {
        this.authParams = params.authParams;
      }
      if (params.date) {
        // set QB session expiration through 2 hours
        date = params.date;
        date.setHours(date.getHours() + 2);
        this.expirationTime = date.toISOString();
      }
      if (this._remember) {
        storage = {
          token: this.token,
          expirationTime: this.expirationTime,
          authParams: this.authParams
        };
        localStorage.setItem('QM.session', JSON.stringify(storage));
      }

    }
  },

  destroy: function() {
    localStorage.removeItem('QM.session');
    this.token = null;
    this.expirationTime = null;
    this.authParams = null;
    this._remember = false;
  },

  // crypto methods for password
  encrypt: function(params) {
    if (params && params.password) {
      params.password = CryptoJS.AES.encrypt(params.password, QMCONFIG.qbAccount.authSecret).toString();
    }
    return params;
  },

  decrypt: function(params) {
    if (params && params.password) {
      params.password = CryptoJS.AES.decrypt(params.password, QMCONFIG.qbAccount.authSecret).toString(CryptoJS.enc.Utf8);
    }
    return params;
  }

};

},{}],8:[function(require,module,exports){
/*
 * Q-municate chat application
 *
 * User Module
 *
 */

module.exports = User;

var tempParams;

function User(app) {
  this.app = app;
  this._is_import = false;
  this._remember = false;
  this._valid = false;
}

User.prototype = {

  connectFB: function(token) {
    var QBApiCalls = this.app.service,
        UserView = this.app.views.User,
        DialogView = this.app.views.Dialog,
        Contact = this.app.models.Contact,
        self = this,
        params;

    UserView.loginQB();
    UserView.createSpinner();

    params = {
      provider: 'facebook',
      keys: {token: token}
    };

    FB.api('/me', function (response) {
      console.log(1111111111, response);
    });

    QBApiCalls.createSession(params, function(session) {
      QBApiCalls.getUser(session.user_id, function(user) {
        self.contact = Contact.create(user);
        self._is_import = getImport(user);

        if (QMCONFIG.debug) console.log('User', self);

        QBApiCalls.connectChat(self.contact.user_jid, function(roster) {
          self.rememberMe();
          UserView.successFormCallback();
          DialogView.prepareDownloading(roster);

          if (!self._is_import) {
            self.import(roster, user);
          } else {
            DialogView.downloadDialogs(roster);
          }
          
        });

      });
    }, true);
  },

  import: function(roster, user) {
    var DialogView = this.app.views.Dialog,
        self = this;

    FB.api('/me/permissions', function (response) {
        if (typeof response.data[3] !== 'undefined' && response.data[3].permission === 'user_friends' && response.data[3].status === 'granted') {

          // import FB friends
          FB.api('/me/friends', function (res) {
              if (QMCONFIG.debug) console.log('FB friends', res);
              var ids = [];

              for (var i = 0, len = res.data.length; i < len; i++) {
                ids.push(res.data[i].id);
              }

              if (ids.length > 0)
                DialogView.downloadDialogs(roster, ids);
              else
                DialogView.downloadDialogs(roster);
            }
          );

        } else {
          DialogView.downloadDialogs(roster);
        }
        self._is_import = true;
        self.updateQBUser(user);
      }
    );
  },

  updateQBUser: function(user) {
    var QBApiCalls = this.app.service,
        custom_data;

    try {
      custom_data = JSON.parse(user.custom_data) || {};
    } catch(err) {
      custom_data = {};
    }

    custom_data.is_import = true;
    custom_data = JSON.stringify(custom_data);
    QBApiCalls.updateUser(user.id, {custom_data: custom_data}, function(res) {
      //if (QMCONFIG.debug) console.log('update of user', res);
    });
  },

  signup: function() {
    var QBApiCalls = this.app.service,
        UserView = this.app.views.User,
        DialogView = this.app.views.Dialog,
        Contact = this.app.models.Contact,
        form = $('section:visible form'),
        self = this,
        params;

    if (validate(form, this)) {
      UserView.createSpinner();

      params = {
        full_name: tempParams.full_name,
        email: tempParams.email,
        password: tempParams.password,
        tag_list: 'web'
      };

      QBApiCalls.createSession({}, function() {
        QBApiCalls.createUser(params, function() {
          delete params.full_name;
          delete params.tag_list;

          QBApiCalls.loginUser(params, function(user) {
            self.contact = Contact.create(user);

            if (QMCONFIG.debug) console.log('User', self);

            QBApiCalls.connectChat(self.contact.user_jid, function(roster) {
              if (tempParams.blob) {
                self.uploadAvatar(roster);
              } else {
                UserView.successFormCallback();
                DialogView.prepareDownloading(roster);
                DialogView.downloadDialogs(roster);
              }
            });
          });

        });
      }, false);
    }
  },

  uploadAvatar: function(roster) {
    var QBApiCalls = this.app.service,
        UserView = this.app.views.User,
        DialogView = this.app.views.Dialog,
        Attach = this.app.models.Attach,
        custom_data,
        self = this;

    Attach.crop(tempParams.blob, {w: 146, h: 146}, function(file) {
      QBApiCalls.createBlob({file: file, 'public': true}, function(blob) {
        self.contact.blob_id = blob.id;
        self.contact.avatar_url = blob.path;

        UserView.successFormCallback();
        DialogView.prepareDownloading(roster);
        DialogView.downloadDialogs(roster);
        
        custom_data = JSON.stringify({avatar_url: blob.path});
        QBApiCalls.updateUser(self.contact.id, {blob_id: blob.id, custom_data: custom_data}, function(res) {
          //if (QMCONFIG.debug) console.log('update of user', res);
        });
      });
    });
  },

  login: function() {
    var QBApiCalls = this.app.service,
        UserView = this.app.views.User,
        DialogView = this.app.views.Dialog,
        Contact = this.app.models.Contact,
        form = $('section:visible form'),
        self = this,
        params;

    if (validate(form, this)) {
      UserView.createSpinner();

      params = {
        email: tempParams.email,
        password: tempParams.password
      };

      QBApiCalls.createSession(params, function(session) {
        QBApiCalls.getUser(session.user_id, function(user) {
          self.contact = Contact.create(user);

          if (QMCONFIG.debug) console.log('User', self);

          QBApiCalls.connectChat(self.contact.user_jid, function(roster) {
            if (self._remember) {
              self.rememberMe();
            }

            UserView.successFormCallback();
            DialogView.prepareDownloading(roster);
            DialogView.downloadDialogs(roster);
          });

        });
      }, self._remember);
    }
  },

  rememberMe: function() {
    var storage = {},
        self = this;

    Object.keys(self.contact).forEach(function(prop) {
      if (prop !== 'app')
        storage[prop] = self.contact[prop];
    });
    
    localStorage.setItem('QM.user', JSON.stringify(storage));
  },

  forgot: function() {
    var QBApiCalls = this.app.service,
        UserView = this.app.views.User,
        form = $('section:visible form'),
        self = this;

    if (validate(form, this)) {
      UserView.createSpinner();

      QBApiCalls.createSession({}, function() {
        QBApiCalls.forgotPassword(tempParams.email, function() {
          UserView.successSendEmailCallback();
          self._valid = false;
        });
      }, false);
    }
  },

  resetPass: function() {
    var QBApiCalls = this.app.service,
        UserView = this.app.views.User,
        form = $('section:visible form'),
        self = this;

    if (validate(form, this)) {
      // UserView.createSpinner();
    }
  },

  autologin: function() {
    var QBApiCalls = this.app.service,
        UserView = this.app.views.User,
        DialogView = this.app.views.Dialog,
        Contact = this.app.models.Contact,
        storage = JSON.parse(localStorage['QM.user']),
        self = this;

    UserView.createSpinner();
    this.contact = Contact.create(storage);

    if (QMCONFIG.debug) console.log('User', self);

    QBApiCalls.connectChat(self.contact.user_jid, function(roster) {
      UserView.successFormCallback();
      DialogView.prepareDownloading(roster);
      DialogView.downloadDialogs(roster);
    });
  },

  logout: function(callback) {
    var QBApiCalls = this.app.service,
        DialogView = this.app.views.Dialog,
        self = this;

    QB.chat.disconnect();
    DialogView.hideDialogs();
    QBApiCalls.logoutUser(function() {
      localStorage.removeItem('QM.user');
      self.contact = null;
      self._remember = false;
      self._valid = false;
      callback();
    });
  }

};

/* Private
---------------------------------------------------------------------- */
function validate(form, user) {
  var maxSize = QMCONFIG.maxLimitFile * 1024 * 1024,
      remember = form.find('input:checkbox')[0],
      file = form.find('input:file')[0],
      fieldName, errName,
      value, errMsg;

  tempParams = {};
  form.find('input:not(:file, :checkbox)').each(function() {
    // fix requeired pattern
    this.value = this.value.trim();

    fieldName = this.id.split('-')[1];
    errName = this.placeholder;
    value = this.value;

    if (this.checkValidity()) {

      user._valid = true;
      tempParams[fieldName] = value;

    } else {

      if (this.validity.valueMissing) {
        errMsg = errName + ' is required';
      } else if (this.validity.typeMismatch) {
        errMsg = QMCONFIG.errors.invalidEmail;
      } else if (this.validity.patternMismatch && errName === 'Name') {
        if (value.length < 3)
          errMsg = QMCONFIG.errors.shortName;
        else if (value.length > 50)
          errMsg = QMCONFIG.errors.bigName;
        else
          errMsg = QMCONFIG.errors.invalidName;
      } else if (this.validity.patternMismatch && (errName === 'Password' || errName === 'New password')) {
        if (value.length < 8)
          errMsg = QMCONFIG.errors.shortPass;
        else if (value.length > 40)
          errMsg = QMCONFIG.errors.bigPass;
        else
          errMsg = QMCONFIG.errors.invalidPass;
      }

      fail(user, errMsg);
      $(this).addClass('is-error').focus();

      return false;
    }
  });

  if (user._valid && remember) {
    user._remember = remember.checked;
  }

  if (user._valid && file && file.files[0]) {
    file = file.files[0];

    if (file.type.indexOf('image/') === -1) {
      errMsg = QMCONFIG.errors.avatarType;
      fail(user, errMsg);
    } else if (file.name.length > 100) {
      errMsg = QMCONFIG.errors.fileName;
      fail(user, errMsg);
    } else if (file.size > maxSize) {
      errMsg = QMCONFIG.errors.fileSize;
      fail(user, errMsg);
    } else {
      tempParams.blob = file;
    }
  }

  return user._valid;
}

function fail(user, errMsg) {
  user._valid = false;
  $('section:visible .text_error').addClass('is-error').text(errMsg);
  $('section:visible input:password').val('');
  $('section:visible .chroma-hash label').css('background-color', 'rgb(255, 255, 255)');
}

function getImport(user) {
  var isImport;
  
  try {
    isImport = JSON.parse(user.custom_data).is_import || false;
  } catch(err) {
    isImport = false;
  }

  return isImport;
}

},{}],9:[function(require,module,exports){
/*
 * Q-municate chat application
 *
 * QuickBlox JS SDK Wrapper
 *
 */

module.exports = QBApiCalls;

var Session, UserView, ContactListView;

function QBApiCalls(app) {
  this.app = app;

  Session = this.app.models.Session;
  UserView = this.app.views.User;
  ContactListView = this.app.views.ContactList;
}

QBApiCalls.prototype = {

  init: function(token) {
    if (typeof token === 'undefined') {
      QB.init(QMCONFIG.qbAccount.appId, QMCONFIG.qbAccount.authKey, QMCONFIG.qbAccount.authSecret);
    } else {
      QB.init(token);

      Session.create(JSON.parse(localStorage['QM.session']), true);
      UserView.autologin();
    }
  },

  checkSession: function(callback) {
    var self = this;

    if ((new Date).toISOString() > Session.expirationTime) {
      // reset QuickBlox JS SDK after autologin via an existing token
      self.init();

      // recovery session
      if (Session.authParams.provider) {
        UserView.getFBStatus(function(token) {
          Session.authParams.keys.token = token;
          self.createSession(Session.authParams, callback, Session._remember);
        });
      } else {
        self.createSession(Session.decrypt(Session.authParams), callback, Session._remember);
        Session.encrypt(Session.authParams);
      }
      
    } else {
      callback();
    }
  },

  createSession: function(params, callback, isRemember) {
    QB.createSession(params, function(err, res) {
      if (err) {
        if (QMCONFIG.debug) console.log(err.detail);

        var errMsg,
            parseErr = JSON.parse(err.detail);

        if (err.code === 401) {
          errMsg = QMCONFIG.errors.unauthorized;
          $('section:visible input:not(:checkbox)').addClass('is-error');
        } else {
          errMsg = parseErr.errors.email ? parseErr.errors.email[0] :
                   parseErr.errors.base ? parseErr.errors.base[0] : parseErr.errors[0];

          // This checking is needed when your user has exited from Facebook
          // and you try to relogin on a project via FB without reload the page.
          // All you need it is to get the new FB user status and show specific error message
          if (errMsg.indexOf('Authentication') >= 0) {
            errMsg = QMCONFIG.errors.crashFBToken;
            UserView.getFBStatus();
          
          // This checking is needed when you trying to connect via FB
          // and your primary email has already been taken on the project 
          } else if (errMsg.indexOf('already') >= 0) {
            errMsg = QMCONFIG.errors.emailExists;
            UserView.getFBStatus();
          } else {
            errMsg = QMCONFIG.errors.session;
          }
        }

        fail(errMsg);
      } else {
        if (QMCONFIG.debug) console.log('QB SDK: Session is created', res);

        if (Session.token) {
          Session.update({ token: res.token });
        } else {
          Session.create({ token: res.token, authParams: Session.encrypt(params) }, isRemember);
        }

        Session.update({ date: new Date });
        callback(res);
      }
    });
  },

  loginUser: function(params, callback) {
    this.checkSession(function(res) {
      QB.login(params, function(err, res) {
        if (err) {
          if (QMCONFIG.debug) console.log(err.detail);

        } else {
          if (QMCONFIG.debug) console.log('QB SDK: User has logged', res);

          Session.update({ date: new Date, authParams: Session.encrypt(params) });
          callback(res);
        }
      });
    });
  },

  logoutUser: function(callback) {
    if (QMCONFIG.debug) console.log('QB SDK: User has exited');
    // reset QuickBlox JS SDK after autologin via an existing token
    this.init();
    Session.destroy();
    callback();
  },

  forgotPassword: function(email, callback) {
    this.checkSession(function(res) {
      QB.users.resetPassword(email, function(response) {
        if (response.code === 404) {
          if (QMCONFIG.debug) console.log(response.message);

          failForgot();
        } else {
          if (QMCONFIG.debug) console.log('QB SDK: Instructions have been sent');

          Session.destroy();
          callback();
        }
      });
    });
  },

  listUsers: function(params, callback) {
    this.checkSession(function(res) {
      QB.users.listUsers(params, function(err, res) {
        if (err) {
          if (QMCONFIG.debug) console.log(err.detail);

        } else {
          if (QMCONFIG.debug) console.log('QB SDK: Users is found', res);

          Session.update({ date: new Date });
          callback(res);
        }
      });
    });
  },

  getUser: function(params, callback) {
    this.checkSession(function(res) {
      QB.users.get(params, function(err, res) {
        if (err && err.code === 404) {
          if (QMCONFIG.debug) console.log(err.message);

          failSearch();
        } else {
          if (QMCONFIG.debug) console.log('QB SDK: Users is found', res);

          Session.update({ date: new Date });
          callback(res);
        }
      });
    });
  },

  createUser: function(params, callback) {
    this.checkSession(function(res) {
      QB.users.create(params, function(err, res) {
        if (err) {
          if (QMCONFIG.debug) console.log(err.detail);

          var parseErr = JSON.parse(err.detail).errors.email[0];
          failUser(parseErr);
        } else {
          if (QMCONFIG.debug) console.log('QB SDK: User is created', res);

          Session.update({ date: new Date });
          callback(res);
        }
      });
    });
  },

  updateUser: function(id, params, callback) {
    this.checkSession(function(res) {
      QB.users.update(id, params, function(err, res) {
        if (err) {
          if (QMCONFIG.debug) console.log(err.detail);

          var parseErr = JSON.parse(err.detail).errors.email[0];
          failUser(parseErr);
        } else {
          if (QMCONFIG.debug) console.log('QB SDK: User is updated', res);

          Session.update({ date: new Date });
          callback(res);
        }
      });
    });
  },

  createBlob: function(params, callback) {
    this.checkSession(function(res) {
      QB.content.createAndUpload(params, function(err, res) {
        if (err) {
          if (QMCONFIG.debug) console.log(err.detail);

        } else {
          if (QMCONFIG.debug) console.log('QB SDK: Blob is uploaded', res);

          Session.update({ date: new Date });
          callback(res);
        }
      });
    });
  },

  connectChat: function(jid, callback) {
    this.checkSession(function(res) {
      var password = Session.authParams.provider ? Session.token :
                     Session.decrypt(Session.authParams).password;

      Session.encrypt(Session.authParams);
      QB.chat.connect({jid: jid, password: password}, function(err, res) {
        if (err) {
          if (QMCONFIG.debug) console.log(err.detail);

          if (err.detail.indexOf('Status.ERROR') >= 0 || err.detail.indexOf('Status.AUTHFAIL') >= 0) {
            fail(err.detail);
            UserView.logout();
            window.location.reload();
          }
        } else {
          Session.update({ date: new Date });
          callback(res);
        }
      });
    });
  },

  listDialogs: function(params, callback) {
    this.checkSession(function(res) {
      QB.chat.dialog.list(params, function(err, res) {
        if (err) {
          if (QMCONFIG.debug) console.log(err.detail);

        } else {
          if (QMCONFIG.debug) console.log('QB SDK: Dialogs is found', res);

          Session.update({ date: new Date });
          callback(res.items);
        }
      });
    });
  },

  createDialog: function(params, callback) {
    this.checkSession(function(res) {
      QB.chat.dialog.create(params, function(err, res) {
        if (err) {
          if (QMCONFIG.debug) console.log(err.detail);

        } else {
          if (QMCONFIG.debug) console.log('QB SDK: Dialog is created', res);

          Session.update({ date: new Date });
          callback(res);
        }
      });
    });
  },

  updateDialog: function(id, params, callback) {
    this.checkSession(function(res) {
      QB.chat.dialog.update(id, params, function(err, res) {
        if (err) {
          if (QMCONFIG.debug) console.log(err.detail);

        } else {
          if (QMCONFIG.debug) console.log('QB SDK: Dialog is updated', res);

          Session.update({ date: new Date });
          callback(res);
        }
      });
    });
  },

  listMessages: function(params, callback) {
    this.checkSession(function(res) {
      QB.chat.message.list(params, function(err, res) {
        if (err) {
          if (QMCONFIG.debug) console.log(err.detail);

        } else {
          if (QMCONFIG.debug) console.log('QB SDK: Messages is found', res);

          Session.update({ date: new Date });
          callback(res.items);
        }
      });
    });
  },

  updateMessage: function(id, params, callback) {
    this.checkSession(function(res) {
      QB.chat.message.update(id, params, function(response) {
        if (response.code === 404) {
          if (QMCONFIG.debug) console.log(response.message);

        } else {
          if (QMCONFIG.debug) console.log('QB SDK: Message is updated');

          Session.update({ date: new Date });
          callback();
        }
      });
    });
  },

  deleteMessage: function(params, callback) {
    this.checkSession(function(res) {
      QB.chat.message.delete(params, function(response) {
        if (response.code === 404) {
          if (QMCONFIG.debug) console.log(response.message);

        } else {
          if (QMCONFIG.debug) console.log('QB SDK: Message is deleted');

          Session.update({ date: new Date });
          callback();
        }
      });
    });
  }

};

/* Private
---------------------------------------------------------------------- */
var fail = function(errMsg) {
  UserView.removeSpinner();
  $('section:visible .text_error').addClass('is-error').text(errMsg);
  $('section:visible input:password').val('');
  $('section:visible .chroma-hash label').css('background-color', 'rgb(255, 255, 255)');
};

var failUser = function(err) {
  var errMsg;

  if (err.indexOf('already') >= 0)
    errMsg = QMCONFIG.errors.emailExists;
  else if (err.indexOf('look like') >= 0)
    errMsg = QMCONFIG.errors.invalidEmail;

  $('section:visible input[type="email"]').addClass('is-error');
  fail(errMsg);
};

var failForgot = function() {
  var errMsg = QMCONFIG.errors.notFoundEmail;
  $('section:visible input[type="email"]').addClass('is-error');
  fail(errMsg);
};

var failSearch = function() {
  $('.popup:visible .note').removeClass('is-hidden').siblings('.popup-elem').addClass('is-hidden');
  ContactListView.removeDataSpinner();
};

},{}],10:[function(require,module,exports){
/*
 * Q-municate chat application
 *
 * Routes Module
 *
 */

module.exports = Routes;

var Session, Dialog, UserView, ContactListView, DialogView, MessageView, AttachView;
var chatName, editedChatName;

function Routes(app) {
  this.app = app;
  
  Session = this.app.models.Session;
  Dialog = this.app.models.Dialog;
  UserView = this.app.views.User;
  ContactListView = this.app.views.ContactList;
  DialogView = this.app.views.Dialog;
  MessageView = this.app.views.Message;
  AttachView = this.app.views.Attach;
}

Routes.prototype = {

  init: function() {

    $(document).on('click', function(event) {
      clickBehaviour(event);
    });

    $('#signup-avatar:file').on('change', function() {
      changeInputFile($(this));
    });

    // change the icon of adding friends [hover effect]
    $('.popup_search').on('mouseenter', '.list-item .icon-normal', function() {
      $(this).css('display', 'none').siblings('.icon-active').css('display', 'inline-block');
    });

    $('.popup_search').on('mouseleave', '.list-item .icon-active', function() {
      $(this).css('display', 'none').siblings('.icon-normal').css('display', 'inline-block');
    });

    /* smiles
    ----------------------------------------------------- */
    $('.smiles-tab').on('click', function() {
      var group = $(this).data('group');
      $(this).addClass('is-actived').siblings().removeClass('is-actived');
      $('.smiles-group_'+group).removeClass('is-hidden').siblings().addClass('is-hidden');
      setCursorToEnd($('.l-chat:visible .textarea'));
    });

    $('.smiles-group').mCustomScrollbar({
      theme: 'minimal-dark',
      scrollInertia: 150
    });

    $('.em-wrap').on('click', function() {
      var code = $(this).find('.em').data('unicode'),
          val = $('.l-chat:visible .textarea').html();

      $('.l-chat:visible .textarea').addClass('contenteditable').html(val + ' ' + minEmoji(code) + ' ');
      setCursorToEnd($('.l-chat:visible .textarea'));
    });

    /* attachments
    ----------------------------------------------------- */
    $('.l-workspace-wrap').on('click', '.btn_message_attach', function() {
      $(this).next().click();
    });

    $('.l-workspace-wrap').on('change', '.attachment', function() {
      AttachView.changeInput($(this));
    });

    $('.l-workspace-wrap').on('click', '.attach-cancel', function(event) {
      event.preventDefault();
      AttachView.cancel($(this));
    });

    $('.l-workspace-wrap').on('click', '.preview', function() {
      if (checkConnection() === false) return false;

      var name = $(this).data('name'),
          url = $(this).data('url'),
          uid = $(this).data('uid'),
          attachType;

      if ($(this).is('.preview-photo')) {
        $('.attach-photo').removeClass('is-hidden').siblings('.attach-video').addClass('is-hidden');
        attachType = 'photo';
      } else {
        $('.attach-video').removeClass('is-hidden').siblings('.attach-photo').addClass('is-hidden');
        attachType = 'video';
      }
      openAttachPopup($('#popupAttach'), name, url, uid, attachType);
    });

    /* group chats
    ----------------------------------------------------- */
    $('.l-workspace-wrap').on('click', '.groupTitle', function() {
      var chat = $('.l-chat:visible');
      if (chat.find('.triangle_up').is('.is-hidden')) {
        chat.find('.triangle_up').removeClass('is-hidden').siblings('.triangle').addClass('is-hidden');
        chat.find('.chat-occupants-wrap').addClass('is-overlay');
        chat.find('.l-chat-content').addClass('l-chat-content_min');
      } else {
        chat.find('.triangle_down').removeClass('is-hidden').siblings('.triangle').addClass('is-hidden');
        chat.find('.chat-occupants-wrap').removeClass('is-overlay');
        chat.find('.l-chat-content').removeClass('l-chat-content_min');
      }
    });

    $('.l-workspace-wrap').on('click', '.groupTitle .addToGroupChat', function(event) {
      event.stopPropagation();
      var dialog_id = $(this).data('dialog');
      if (QMCONFIG.debug) console.log('add people to groupchat');
      ContactListView.addContactsToChat($(this), 'add', dialog_id);
    });

    $('.l-workspace-wrap').on('click', '.groupTitle .leaveChat, .groupTitle .avatar', function(event) {
      event.stopPropagation();
    });
    
    /* change the chat name
    ----------------------------------------------------- */
    $('.l-workspace-wrap').on('mouseenter focus', '.groupTitle .name_chat', function() {
      var chat = $('.l-chat:visible');
      chat.find('.triangle:visible').addClass('is-hover').siblings('.pencil').removeClass('is-hidden');
    });

    $('.l-workspace-wrap').on('mouseleave', '.groupTitle .name_chat', function() {
      var chat = $('.l-chat:visible');
      if (!$(this).is('.is-focus'))
        chat.find('.triangle.is-hover').removeClass('is-hover').siblings('.pencil').addClass('is-hidden');
    });

    $(document.body).on('click', function() {
      var chat = $('.l-chat:visible');
      if (chat.find('.groupTitle .name_chat').is('.is-focus')) {
        chat.find('.groupTitle .name_chat').removeClass('is-focus');
        chat.find('.groupTitle .name_chat')[0].scrollLeft = 0;
        chat.find('.triangle.is-hover').removeClass('is-hover').siblings('.pencil').addClass('is-hidden');

        if (editedChatName && !editedChatName.name) {
          chat.find('.name_chat').text(chatName.name);
        } else if (editedChatName && (editedChatName.name !== chatName.name) && (editedChatName.created_at > chatName.created_at)) {
          chat.find('.name_chat').text(editedChatName.name).attr('title', editedChatName.name);
          Dialog.changeName(chat.data('dialog'), editedChatName.name);
        } else {
          chat.find('.name_chat').text(chat.find('.name_chat').text().trim());
        }
      }
    });

    $('.l-workspace-wrap').on('click', '.groupTitle .name_chat', function(event) {
      event.stopPropagation();
      $(this).addClass('is-focus');
      chatName = {
        name: $(this).text().trim(),
        created_at: Date.now()
      };
      removePopover();
    });

    $('.l-workspace-wrap').on('keyup', '.groupTitle .name_chat', function(event) {
      var code = event.keyCode;
      editedChatName = {
        name: $(this).text().trim(),
        created_at: Date.now()
      };
      if (code === 13) {
        $(document.body).click();
        $(this).blur();
      } else if (code === 27) {
        editedChatName = null;
        $(this).text(chatName.name);
        $(document.body).click();
        $(this).blur();
      }
    });

    /* change the chat avatar
    ----------------------------------------------------- */
    $('.l-workspace-wrap').on('mouseenter', '.groupTitle .avatar', function() {
      var chat = $('.l-chat:visible');
      chat.find('.pencil_active').removeClass('is-hidden');
    });

    $('.l-workspace-wrap').on('mouseleave', '.groupTitle .avatar', function() {
      var chat = $('.l-chat:visible');
      chat.find('.pencil_active').addClass('is-hidden');
    });

    $('.l-workspace-wrap').on('click', '.groupTitle .pencil_active', function() {
      $(this).siblings('input:file').click();
      removePopover();
    });

    $('.l-workspace-wrap').on('change', '.groupTitle .avatar_file', function() {
      var chat = $('.l-chat:visible');
      Dialog.changeAvatar(chat.data('dialog'), $(this), function(avatar) {
        if (!avatar) return false;
        chat.find('.avatar_chat').css('background-image', 'url('+avatar+')');
      });
    });

    /* scrollbars
    ----------------------------------------------------- */
    occupantScrollbar();

    /* welcome page
    ----------------------------------------------------- */
    $('#signupFB, #loginFB').on('click', function(event) {
      if (checkConnection() === false) return false;

      if (QMCONFIG.debug) console.log('connect with FB');
      event.preventDefault();

      // NOTE!! You should use FB.login method instead FB.getLoginStatus
      // and your browser won't block FB Login popup
      FB.login(function(response) {
        if (QMCONFIG.debug) console.log('FB authResponse', response);
        if (response.status === 'connected') {
          UserView.connectFB(response.authResponse.accessToken);
        }
      }, {scope: QMCONFIG.fbAccount.scope});
    });

    $('#signupQB').on('click', function() {
      if (QMCONFIG.debug) console.log('signup with QB');
      UserView.signupQB();
    });

    $('#loginQB').on('click', function(event) {
      if (QMCONFIG.debug) console.log('login wih QB');
      event.preventDefault();
      UserView.loginQB();
    });

    /* signup page
    ----------------------------------------------------- */
    $('#signupForm').on('click submit', function(event) {
      if (checkConnection() === false) return false;

      if (QMCONFIG.debug) console.log('create user');
      event.preventDefault();
      UserView.signupForm();
    });

    /* login page
    ----------------------------------------------------- */
    $('#forgot').on('click', function(event) {
      if (QMCONFIG.debug) console.log('forgot password');
      event.preventDefault();
      UserView.forgot();
    });

    $('#loginForm').on('click submit', function(event) {
      if (checkConnection() === false) return false;

      if (QMCONFIG.debug) console.log('authorize user');
      event.preventDefault();
      UserView.loginForm();
    });

    /* forgot and reset page
    ----------------------------------------------------- */
    $('#forgotForm').on('click submit', function(event) {
      if (checkConnection() === false) return false;

      if (QMCONFIG.debug) console.log('send letter');
      event.preventDefault();
      UserView.forgotForm();
    });

    $('#resetForm').on('click submit', function(event) {
      if (checkConnection() === false) return false;

      if (QMCONFIG.debug) console.log('reset password');
      event.preventDefault();
      UserView.resetForm();
    });

    /* popovers
    ----------------------------------------------------- */
    $('#profile').on('click', function(event) {
      event.preventDefault();
      removePopover();
      UserView.profilePopover($(this));
    });

    $('.list_contextmenu').on('contextmenu', '.contact', function(event) {
      event.preventDefault();
      removePopover();
      UserView.contactPopover($(this));
    });

    $('.l-workspace-wrap').on('click', '.occupant', function(event) {
      event.preventDefault();
      removePopover();
      UserView.occupantPopover($(this), event);
    });

    $('.l-workspace-wrap').on('click', '.btn_message_smile', function() {
      var bool = $(this).is('.is-active');
      removePopover();
      if (bool === false)
        UserView.smilePopover($(this));
      setCursorToEnd($('.l-chat:visible .textarea'));
    });

    /* popups
    ----------------------------------------------------- */
    $('.header-links-item').on('click', '#logout', function(event) {
      event.preventDefault();
      openPopup($('#popupLogout'));
    });

    $('.list, .l-workspace-wrap').on('click', '.deleteContact', function(event) {
      event.preventDefault();
      var id = $(this).parents('.presence-listener').data('id');
      openPopup($('#popupDelete'), id);
    });

    $('.list, .l-workspace-wrap').on('click', '.leaveChat', function(event) {
      event.preventDefault();
      var parent = $(this).parents('.presence-listener')[0] ? $(this).parents('.presence-listener') : $(this).parents('.is-group');
      var dialog_id = parent.data('dialog');
      openPopup($('#popupLeave'), null, dialog_id);
    });

    $('#logoutConfirm').on('click', function() {
      if (checkConnection() === false) return false;

      UserView.logout();
    });

    $('#deleteConfirm').on('click', function() {
      if (checkConnection() === false) return false;

      if (QMCONFIG.debug) console.log('delete contact');
      ContactListView.sendDelete($(this));
    });

    $('#leaveConfirm').on('click', function() {
      if (checkConnection() === false) return false;

      if (QMCONFIG.debug) console.log('leave chat');
      DialogView.leaveGroupChat($(this));
    });

    $('.popup-control-button, .btn_popup_private').on('click', function(event) {
      event.preventDefault();
      closePopup();
    });

    $('.search').on('click', function() {
      if (QMCONFIG.debug) console.log('global search');
      ContactListView.globalPopup();
    });

    $('#mainPage').on('click', '.createGroupChat', function(event) {
      event.preventDefault();
      if (QMCONFIG.debug) console.log('add people to groupchat');
      ContactListView.addContactsToChat($(this));
    });

    $('.l-sidebar').on('click', '.addToGroupChat', function(event) {
      event.preventDefault();
      var dialog_id = $(this).data('dialog');
      if (QMCONFIG.debug) console.log('add people to groupchat');
      ContactListView.addContactsToChat($(this), 'add', dialog_id);
    });

    /* search
    ----------------------------------------------------- */
    $('#globalSearch').on('submit', function(event) {
      if (checkConnection() === false) return false;

      event.preventDefault();
      ContactListView.globalSearch($(this));
    });

    $('.localSearch').on('keyup search submit', function(event) {
      event.preventDefault();
      var type = event.type,
          code = event.keyCode; // code=27 (Esc key), code=13 (Enter key)

      if ((type === 'keyup' && code !== 27 && code !== 13) || (type === 'search')) {
        if (this.id === 'searchContacts')
          UserView.localSearch($(this));
        else
          UserView.friendsSearch($(this));
      }
    });

    /* subscriptions
    ----------------------------------------------------- */
    $('.list_contacts').on('click', 'button.send-request', function() {
      if (checkConnection() === false) return false;

      if (QMCONFIG.debug) console.log('send subscribe');
      ContactListView.sendSubscribe($(this));
    });

    $('.l-workspace-wrap').on('click', '.btn_request_again', function() {
      if (checkConnection() === false) return false;

      if (QMCONFIG.debug) console.log('send subscribe');
      ContactListView.sendSubscribe($(this), true);
    });

    $('body').on('click', '.requestAction', function(event) {
      if (checkConnection() === false) return false;

      event.preventDefault();
      if (QMCONFIG.debug) console.log('send subscribe');
      ContactListView.sendSubscribe($(this));
    });

    $('.list').on('click', '.request-button_ok', function() {
      if (checkConnection() === false) return false;

      if (QMCONFIG.debug) console.log('send confirm');
      ContactListView.sendConfirm($(this));
    });

    $('.list').on('click', '.request-button_cancel', function() {
      if (checkConnection() === false) return false;

      if (QMCONFIG.debug) console.log('send reject');
      ContactListView.sendReject($(this));
    });

    /* dialogs
    ----------------------------------------------------- */
    $('.list').on('click', '.contact', function(event) {
      if (event.target.tagName !== 'INPUT')
        event.preventDefault();
    });

    $('#popupContacts').on('click', '.contact', function() {
      var obj = $(this).parent(),
          popup = obj.parents('.popup'),
          len;

      if (obj.is('.is-chosen'))
        obj.removeClass('is-chosen').find('input').prop('checked', false);
      else
        obj.addClass('is-chosen').find('input').prop('checked', true);

      len = obj.parent().find('li.is-chosen').length;
      if (len === 1 && !popup.is('.is-addition')) {
        popup.removeClass('not-selected');
        popup.find('.btn_popup_private').removeClass('is-hidden').siblings().addClass('is-hidden');
      } else if (len >= 1) {
        popup.removeClass('not-selected');
        if (popup.is('.add'))
          popup.find('.btn_popup_add').removeClass('is-hidden').siblings().addClass('is-hidden');
        else
          popup.find('.btn_popup_group').removeClass('is-hidden').siblings().addClass('is-hidden');
      } else {
        popup.addClass('not-selected');
      }
    });

    $('.list_contextmenu').on('click', '.contact', function() {
      DialogView.htmlBuild($(this));
    });

    $('#popupContacts .btn_popup_private').on('click', function() {
      var id = $('#popupContacts .is-chosen').data('id'),
          dialogItem = $('.dialog-item[data-id="'+id+'"]').find('.contact');
      
      DialogView.htmlBuild(dialogItem);
    });

    $('body').on('click', '.writeMessage', function(event) {
      event.preventDefault();

      var id = $(this).data('id'),
          dialogItem = $('.dialog-item[data-id="'+id+'"]').find('.contact');
      
      DialogView.htmlBuild(dialogItem);
    });

    $('#popupContacts .btn_popup_group').on('click', function() {
      if (checkConnection() === false) return false;

      DialogView.createGroupChat();
    });

    $('#popupContacts .btn_popup_add').on('click', function() {
      if (checkConnection() === false) return false;

      var dialog_id = $(this).parents('.popup').data('dialog');
      DialogView.createGroupChat('add', dialog_id);
    });

    $('.l-workspace-wrap').on('keydown', '.l-message', function(event) {
      var shiftKey = event.shiftKey,
          code = event.keyCode, // code=27 (Esc key), code=13 (Enter key)
          val = $('.l-chat:visible .textarea').html().trim();

      if (code === 13 && !shiftKey) {
        MessageView.sendMessage($(this));
        $(this).find('.textarea').empty();
        removePopover();
      }
    });

    $('.l-workspace-wrap').on('keyup', '.l-message', function() {
      var val = $('.l-chat:visible .textarea').text().trim();

      if (val.length > 0)
        $('.l-chat:visible .textarea').addClass('contenteditable');
      else
        $('.l-chat:visible .textarea').removeClass('contenteditable').empty();
    });

    $('.l-workspace-wrap').on('submit', '.l-message', function(event) {
      event.preventDefault();
    });

    $('#home').on('click', function(event) {
      event.preventDefault();
      $('#capBox').removeClass('is-hidden').siblings().addClass('is-hidden');
      $('.is-selected').removeClass('is-selected');
    });

    /* temporary routes
    ----------------------------------------------------- */
    $('#share').on('click', function(event) {
      if (checkConnection() === false) return false;

      event.preventDefault();
    });

  }
};

/* Private
---------------------------------------------------------------------- */
function occupantScrollbar() {
  $('.chat-occupants').mCustomScrollbar({
    theme: 'minimal-dark',
    scrollInertia: 50,
    live: true
  });
}

// Checking if the target is not an object run popover
function clickBehaviour(e) {
  var objDom = $(e.target);

  if (objDom.is('#profile, #profile *, .occupant, .occupant *, .btn_message_smile, .btn_message_smile *, .popover_smile, .popover_smile *') || e.which === 3) {
    return false;
  } else {
    removePopover();
    if (objDom.is('.popups') && !$('.popup.is-overlay').is('.is-open')) {
      closePopup();
    } else {
      return false;
    }
  }
}

function changeInputFile(objDom) {
  var URL = window.webkitURL || window.URL,
      file = objDom[0].files[0],
      src = file ? URL.createObjectURL(file) : QMCONFIG.defAvatar.url,
      fileName = file ? file.name : QMCONFIG.defAvatar.caption;
  
  objDom.prev().find('.avatar').css('background-image', "url("+src+")").siblings('span').text(fileName);
  // if (typeof file !== 'undefined') URL.revokeObjectURL(src);
}

function removePopover() {
  $('.is-contextmenu').removeClass('is-contextmenu');
  $('.is-active').removeClass('is-active');
  $('.btn_message_smile .is-hidden').removeClass('is-hidden').siblings().remove();
  $('.popover:not(.popover_smile)').remove();
  $('.popover_smile').hide();
}

function openPopup(objDom, id, dialog_id) {
  // if it was the delete action
  if (id) {
    objDom.find('#deleteConfirm').data('id', id);
  }
  // if it was the leave action
  if (dialog_id) {
    objDom.find('#leaveConfirm').data('dialog', dialog_id);
  }
  objDom.add('.popups').addClass('is-overlay');
}

function openAttachPopup(objDom, name, url, uid, attachType) {
  if (attachType === 'video')
    objDom.find('.attach-video video').attr('src', url);
  else
    objDom.find('.attach-photo').attr('src', url);
  
  objDom.find('.attach-name').text(name);
  objDom.find('.attach-download').attr('href', getFileDownloadLink(uid));
  objDom.add('.popups').addClass('is-overlay');
}

function closePopup() {
  $('.is-overlay:not(.chat-occupants-wrap)').removeClass('is-overlay');
  $('.temp-box').remove();
  $('.attach-video video')[0].pause();
}

function getFileDownloadLink(uid) {
  return 'https://api.quickblox.com/blobs/'+uid+'?token='+Session.token;
}

function setCursorToEnd(el) {
  el.focus();
  if (typeof window.getSelection != "undefined" && typeof document.createRange != "undefined") {
    var range = document.createRange();
    range.selectNodeContents(el.get(0));
    range.collapse(false);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  } else if (typeof document.body.createTextRange != "undefined") {
    var textRange = document.body.createTextRange();
    textRange.moveToElementText(el.get(0));
    textRange.collapse(false);
    textRange.select();
  }
}

function checkConnection() {
  if (window.onLine === false) {
    alert('Sorry. You need to recover your Internet connection');
    return false;
  } else {
    return true;
  }
}

},{}],11:[function(require,module,exports){
/*
 * Q-municate chat application
 *
 * Attach View Module
 *
 */

module.exports = AttachView;

var User, Message, Attach;
var self;

function AttachView(app) {
  this.app = app;
  User = this.app.models.User;
  Message = this.app.models.Message;
  Attach = this.app.models.Attach;
  self = this;
}

AttachView.prototype = {

  changeInput: function(objDom) {
    var file = objDom[0].files[0] || null,
        chat = $('.l-chat:visible .l-chat-content .mCSB_container'),
        id = _.uniqueId(),
        fileSize = file.size,
        fileSizeCrop = fileSize > (1024 * 1024) ? (fileSize / (1024 * 1024)).toFixed(1) : (fileSize / 1024).toFixed(1),
        fileSizeUnit = fileSize > (1024 * 1024) ? 'MB' : 'KB',
        maxSize = QMCONFIG.maxLimitFile * 1024 * 1024,
        errMsg, html;

    if (file) {
      if (file.name.length > 100)
        errMsg = QMCONFIG.errors.fileName;
      else if (file.size > maxSize)
        errMsg = QMCONFIG.errors.fileSize;

      if (errMsg) {
        html = '<article class="message message_service l-flexbox l-flexbox_alignstretch">';
        html += '<span class="message-avatar contact-avatar_message request-button_pending"></span>';
        html += '<div class="message-container-wrap">';
        html += '<div class="message-container l-flexbox l-flexbox_flexbetween l-flexbox_alignstretch">';
        html += '<div class="message-content">';
        html += '<h4 class="message-author message-error">'+errMsg+'</h4>';
        html += '</div>';
        html += '</div></div></article>';
        chat.append(html);
        objDom.val('');
        fixScroll();
        return false;
      }

      if (file.name.length < 17)
        html = '<article class="message message_service message_attach message_attach_row l-flexbox l-flexbox_alignstretch">';
      else
        html = '<article class="message message_service message_attach l-flexbox l-flexbox_alignstretch">';
      html += '<span class="message-avatar contact-avatar_message request-button_attach">';
      html += '<img src="images/icon-attach.png" alt="attach"></span>';
      html += '<div class="message-container-wrap">';
      html += '<div class="message-container l-flexbox l-flexbox_flexbetween l-flexbox_alignstretch">';
      html += '<div class="message-content">';
      html += '<h4 class="message-author">';
      html += file.name;
      html += '<div class="attach-upload">';
      html += '<div id="progress_'+id+'"></div>';
      html += '<span class="attach-size"><span class="attach-part attach-part_'+id+'"></span> of ' + fileSizeCrop + ' ' + fileSizeUnit + '</span>';
      html += '</div></h4></div>';
      html += '<time class="message-time"><a class="attach-cancel" href="#">Cancel</a></time>';
      html += '</div></div></article>';
      
      chat.append(html);
      objDom.val('');
      fixScroll();
      if (file.type.indexOf('image') > -1) {
        Attach.crop(file, {w: 1000, h: 1000}, function(blob) {
          self.createProgressBar(id, fileSizeCrop, fileSize, blob);
        });
      } else {
        self.createProgressBar(id, fileSizeCrop, fileSize, file);
      }
    }
  },

  createProgressBar: function(id, fileSizeCrop, fileSize, file) {
    var progressBar = new ProgressBar('progress_'+id),
        percent = 5,
        isUpload = false,
        part, time;

    // TODO: Need to rewrite this part of code
    if (fileSize < 100 * 1024)
      time = 50;
    else if (fileSize < 300 * 1024)
      time = 200;
    else if (fileSize < 400 * 1024)
      time = 350;
    else if (fileSize < 500 * 1024)
      time = 400;
    else if (fileSize < 600 * 1024)
      time = 450;
    else if (fileSize < 700 * 1024)
      time = 550;
    else if (fileSize < 800 * 1024)
      time = 600;
    else if (fileSize < 900 * 1024)
      time = 650;
    else if (fileSize < 1 * 1024 * 1024)
      time = 1000;
    else if (fileSize < 2 * 1024 * 1024)
      time = 1400;
    else if (fileSize < 3 * 1024 * 1024)
      time = 2000;
    else if (fileSize < 4 * 1024 * 1024)
      time = 2700;
    else if (fileSize < 5 * 1024 * 1024)
      time = 3700;
    else if (fileSize < 6 * 1024 * 1024)
      time = 4900;
    else if (fileSize < 7 * 1024 * 1024)
      time = 5400;
    else if (fileSize < 8 * 1024 * 1024)
      time = 6600;
    else if (fileSize < 9 * 1024 * 1024)
      time = 7500;
    else if (fileSize < 10 * 1024 * 1024)
      time = 9000;

    setPercent();

    console.log(1111111, file);

    Attach.upload(file, function(blob) {
      console.log(2222222, blob);

      var chat;
      isUpload = true;
      if ($('#progress_'+id).length > 0) {
        chat = $('#progress_'+id).parents('.l-chat');
        setPercent();
        self.sendMessage(chat, blob, fileSize);
      }
    });

    function setPercent() {
      if (isUpload) {
        progressBar.setPercent(100);
        part = fileSizeCrop;
        $('.attach-part_'+id).text(part);

        setTimeout(function() {
          $('.attach-part_'+id).parents('article').remove();
        }, 50);

      } else {
        progressBar.setPercent(percent);
        part = (fileSizeCrop * percent / 100).toFixed(1);
        $('.attach-part_'+id).text(part);
        percent += 5;
        if (percent > 90) return false;
        setTimeout(setPercent, time);
      }      
    }  
  },

  cancel: function(objDom) {
    objDom.parents('article').remove();
  },

  sendMessage: function(chat, blob, size) {
    var MessageView = this.app.views.Message,
        attach = Attach.create(blob, size),
        jid = chat.data('jid'),
        id = chat.data('id'),
        dialog_id = chat.data('dialog'),
        time = Math.floor(Date.now() / 1000),
        type = chat.is('.is-group') ? 'groupchat' : 'chat',
        dialogItem = type === 'groupchat' ? $('.l-list-wrap section:not(#searchList) .dialog-item[data-dialog="'+dialog_id+'"]') : $('.l-list-wrap section:not(#searchList) .dialog-item[data-id="'+id+'"]'),
        copyDialogItem;
      
    // send message
    QB.chat.send(jid, {type: type, extension: {
      save_to_history: 1,
      dialog_id: dialog_id,
      date_sent: time,

      attachments: [
        attach
      ],

      full_name: User.contact.full_name,
      avatar_url: User.contact.avatar_url
    }});

    message = Message.create({
      chat_dialog_id: dialog_id,
      date_sent: time,
      attachment: attach,
      sender_id: User.contact.id
    });
    if (QMCONFIG.debug) console.log(message);
    if (type === 'chat') MessageView.addItem(message, true, true);

    if (dialogItem.length > 0) {
      copyDialogItem = dialogItem.clone();
      dialogItem.remove();
      $('#recentList ul').prepend(copyDialogItem);
      if (!$('#searchList').is(':visible')) {
        $('#recentList').removeClass('is-hidden');
        isSectionEmpty($('#recentList ul'));
      }
    }
  }

};

/* Private
---------------------------------------------------------------------- */
function fixScroll() {
  var chat = $('.l-chat:visible'),
      containerHeight = chat.find('.l-chat-content .mCSB_container').height(),
      chatContentHeight = chat.find('.l-chat-content').height(),
      draggerContainerHeight = chat.find('.l-chat-content .mCSB_draggerContainer').height(),
      draggerHeight = chat.find('.l-chat-content .mCSB_dragger').height();

  chat.find('.l-chat-content .mCSB_container').css({top: chatContentHeight - containerHeight + 'px'});
  chat.find('.l-chat-content .mCSB_dragger').css({top: draggerContainerHeight - draggerHeight + 'px'});
}

function isSectionEmpty(list) {
  if (list.contents().length === 0)
    list.parent().addClass('is-hidden');

  if ($('#historyList ul').contents().length === 0)
      $('#historyList ul').parent().addClass('is-hidden');

  if ($('#requestsList').is('.is-hidden') &&
      $('#recentList').is('.is-hidden') &&
      $('#historyList').is('.is-hidden')) {
    
    $('#emptyList').removeClass('is-hidden');
  }
}

},{}],12:[function(require,module,exports){
/*
 * Q-municate chat application
 *
 * Contact List View Module
 *
 */

module.exports = ContactListView;

var Dialog, Message, ContactList, User;

function ContactListView(app) {
  this.app = app;
  Dialog = this.app.models.Dialog;
  Message = this.app.models.Message;
  ContactList = this.app.models.ContactList;
  User = this.app.models.User;

  scrollbarContacts();
}

ContactListView.prototype = {

  createDataSpinner: function(list) {
    var spinnerBlock = '<div class="popup-elem spinner_bounce">';
    spinnerBlock += '<div class="spinner_bounce-bounce1"></div>';
    spinnerBlock += '<div class="spinner_bounce-bounce2"></div>';
    spinnerBlock += '<div class="spinner_bounce-bounce3"></div>';
    spinnerBlock += '</div>';

    list.after(spinnerBlock);
  },

  removeDataSpinner: function() {
    $('.popup:visible .spinner_bounce').remove();
    $('.popup:visible input').prop('disabled', false);
  },

  globalPopup: function() {
    var popup = $('#popupSearch');

    openPopup(popup);
    popup.find('.popup-elem').addClass('is-hidden').siblings('form').find('input').val('');
    popup.find('.mCSB_container').empty();
  },

  globalSearch: function(form) {
    var self = this,
        popup = form.parent(),
        list = popup.find('ul:first'),
        val = form.find('input[type="search"]').val().trim();

    if (val.length > 0) {
      form.find('input').prop('disabled', true).val(val);
      popup.find('.popup-elem').addClass('is-hidden');
      popup.find('.mCSB_container').empty();

      scrollbar(list, self);
      self.createDataSpinner(list);
      $('.popup:visible .spinner_bounce').removeClass('is-hidden').addClass('is-empty');

      sessionStorage.setItem('QM.search.value', val);
      sessionStorage.setItem('QM.search.page', 1);

      ContactList.globalSearch(function(results) {
        createListResults(list, results, self);
      });
    }
  },

  addContactsToChat: function(objDom, type, dialog_id) {
    var ids = objDom.data('ids') ? objDom.data('ids').toString().split(',') : [],
        popup = $('#popupContacts'),
        contacts = ContactList.contacts,
        roster = ContactList.roster,
        html, sortedContacts, friends, user_id;

    openPopup(popup, type, dialog_id);
    popup.addClass('not-selected').removeClass('is-addition');
    popup.find('.note').addClass('is-hidden').siblings('ul').removeClass('is-hidden');
    popup.find('form')[0].reset();
    popup.find('.list_contacts').mCustomScrollbar("scrollTo","top");
    popup.find('.mCSB_container').empty();
    popup.find('.btn').removeClass('is-hidden');

    // get your friends which are sorted by alphabet
    sortedContacts = _.pluck( _.sortBy(contacts, 'full_name') , 'id').map(String);
    friends = _.filter(sortedContacts, function(el) {
      return roster[el] && roster[el].subscription !== 'none';
    });
    if (QMCONFIG.debug) console.log('Friends', friends);

    // exclude users who are already present in the dialog
    friends = _.difference(friends, ids);

    for (var i = 0, len = friends.length; i < len; i++) {
      user_id = friends[i];

      html = '';
      html += '<li class="list-item" data-id="'+user_id+'">';
      html += '<a class="contact l-flexbox" href="#">';
      html += '<div class="l-flexbox_inline">';
      // html += '<img class="contact-avatar avatar" src="'+contacts[user_id].avatar_url+'" alt="user">';
      html += '<div class="contact-avatar avatar" style="background-image:url('+contacts[user_id].avatar_url+')"></div>';
      html += '<span class="name">'+contacts[user_id].full_name+'</span>';
      html += '</div><input class="form-checkbox" type="checkbox">';
      html += '</a></li>';
      
      popup.find('.mCSB_container').append(html);      
    }

    if (ids.length > 0)
      popup.addClass('is-addition').data('existing_ids', ids);
    else
      popup.data('existing_ids', null);
  },

  // subscriptions

  importFBFriend: function(id) {
    var jid = QB.chat.helpers.getUserJid(id, QMCONFIG.qbAccount.appId),
        roster = ContactList.roster;

    QB.chat.roster.add(jid, function() {
      // update roster
      roster[id] = {
        subscription: 'none',
        ask: 'subscribe'
      };
      ContactList.saveRoster(roster);

      Dialog.createPrivate(jid);
    });

  },

  sendSubscribe: function(objDom, isChat) {
    var MessageView = this.app.views.Message,
        jid = isChat ? objDom.parents('.l-chat').data('jid') : objDom.parents('li').data('jid'),
        roster = ContactList.roster,
        id = QB.chat.helpers.getIdFromNode(jid),
        dialogItem = $('.dialog-item[data-id="'+id+'"]')[0],
        requestItem = $('#requestsList .list-item[data-jid="'+jid+'"]'),
        notConfirmed = localStorage['QM.notConfirmed'] ? JSON.parse(localStorage['QM.notConfirmed']) : {},
        time = Math.floor(Date.now() / 1000),
        message, copyDialogItem,
        self = this;
    
    if (!isChat) {
      objDom.after('<span class="send-request l-flexbox">Request Sent</span>');
      objDom.remove();
    }

    if (notConfirmed[id] && requestItem[0]) {
      self.sendConfirm(requestItem);
    } else {
      QB.chat.roster.add(jid, function() {
        // update roster
        roster[id] = {
          subscription: 'none',
          ask: 'subscribe'
        };
        ContactList.saveRoster(roster);

        if (dialogItem) {
          // send notification about subscribe
          QB.chat.send(jid, {type: 'chat', extension: {
            save_to_history: 1,
            dialog_id: dialogItem.getAttribute('data-dialog'),
            date_sent: time,

            notification_type: '3',
            full_name: User.contact.full_name,
          }});

          message = Message.create({
            chat_dialog_id: dialogItem.getAttribute('data-dialog'),
            notification_type: '3',
            date_sent: time,
            sender_id: User.contact.id
          });

          MessageView.addItem(message, true, true);
        } else {
          Dialog.createPrivate(jid, true);
        }

        dialogItem = $('.l-list-wrap section:not(#searchList) .dialog-item[data-id="'+id+'"]');
        copyDialogItem = dialogItem.clone();
        dialogItem.remove();
        $('#recentList ul').prepend(copyDialogItem);
        if (!$('#searchList').is(':visible')) {
         $('#recentList').removeClass('is-hidden');
         isSectionEmpty($('#recentList ul')); 
        }
      });
    }

  },

  sendConfirm: function(objDom) {
    var DialogView = this.app.views.Dialog,
        MessageView = this.app.views.Message,
        jid = objDom.data('jid') || objDom.parents('li').data('jid'),
        id = QB.chat.helpers.getIdFromNode(jid),
        list = objDom.parents('ul'),
        roster = ContactList.roster,
        notConfirmed = localStorage['QM.notConfirmed'] ? JSON.parse(localStorage['QM.notConfirmed']) : {},
        hiddenDialogs = JSON.parse(sessionStorage['QM.hiddenDialogs']),
        li, dialog, message, dialogItem, copyDialogItem,
        time = Math.floor(Date.now() / 1000);

    if (objDom.is('.request-button'))
      objDom.parents('li').remove();
    else
      objDom.remove();
    isSectionEmpty(list);

    // update roster
    roster[id] = {
      subscription: 'from',
      ask: 'subscribe'
    };
    ContactList.saveRoster(roster);

    // update notConfirmed people list
    delete notConfirmed[id];
    ContactList.saveNotConfirmed(notConfirmed);

    QB.chat.roster.confirm(jid, function() {
      // send notification about confirm
      QB.chat.send(jid, {type: 'chat', extension: {
        save_to_history: 1,
        dialog_id: hiddenDialogs[id],
        date_sent: time,

        notification_type: '5',
        full_name: User.contact.full_name,
      }});

      message = Message.create({
        chat_dialog_id: hiddenDialogs[id],
        notification_type: '5',
        date_sent: time,
        sender_id: User.contact.id
      });
      MessageView.addItem(message, true, true);

      // delete duplicate contact item
      li = $('.dialog-item[data-id="'+id+'"]');
      list = li.parents('ul');
      li.remove();
      isSectionEmpty(list);

      dialog = Dialog.create({
        _id: hiddenDialogs[id],
        type: 3,
        occupants_ids: [id],
        unread_count: ''
      });
      ContactList.dialogs[dialog.id] = dialog;
      if (QMCONFIG.debug) console.log('Dialog', dialog);
      if (!localStorage['QM.dialog-' + dialog.id]) {
        localStorage.setItem('QM.dialog-' + dialog.id, JSON.stringify({ messages: [] }));
      }

      DialogView.addDialogItem(dialog);

      dialogItem = $('.l-list-wrap section:not(#searchList) .dialog-item[data-id="'+id+'"]');
      copyDialogItem = dialogItem.clone();
      dialogItem.remove();
      $('#recentList ul').prepend(copyDialogItem);
      if (!$('#searchList').is(':visible')) {
       $('#recentList').removeClass('is-hidden');
       isSectionEmpty($('#recentList ul')); 
      }

      dialogItem = $('.presence-listener[data-id="'+id+'"]');
      dialogItem.find('.status').removeClass('status_request');
    });
    
  },

  sendReject: function(objDom) {
    var jid = objDom.parents('li').data('jid'),
        id = QB.chat.helpers.getIdFromNode(jid),
        list = objDom.parents('ul'),
        roster = ContactList.roster,
        notConfirmed = localStorage['QM.notConfirmed'] ? JSON.parse(localStorage['QM.notConfirmed']) : {},
        hiddenDialogs = JSON.parse(sessionStorage['QM.hiddenDialogs']);

    objDom.parents('li').remove();
    isSectionEmpty(list);

    // update roster
    roster[id] = {
      subscription: 'none',
      ask: null
    };
    ContactList.saveRoster(roster);

    // update notConfirmed people list
    delete notConfirmed[id];
    ContactList.saveNotConfirmed(notConfirmed);

    QB.chat.roster.reject(jid, function() {
      // send notification about reject
      QB.chat.send(jid, {type: 'chat', extension: {
        save_to_history: 1,
        dialog_id: hiddenDialogs[id],
        date_sent: Math.floor(Date.now() / 1000),

        notification_type: '4',
        full_name: User.contact.full_name,
      }});
    });

  },

  sendDelete: function(objDom) {
    var contacts = ContactList.contacts,
        dialogs = ContactList.dialogs,
        id = objDom.data('id'),
        jid = QB.chat.helpers.getUserJid(id, QMCONFIG.qbAccount.appId),
        li = $('.dialog-item[data-id="'+id+'"]'),
        chat = $('.l-chat[data-id="'+id+'"]'),
        list = li.parents('ul'),
        dialog_id = li.data('dialog'),
        roster = ContactList.roster;

    // update roster
    delete roster[id];
    ContactList.saveRoster(roster);

    // delete dialog messages
    localStorage.removeItem('QM.dialog-' + dialog_id);

    // send notification about reject
    QB.chat.send(jid, {type: 'chat', extension: {
      save_to_history: 1,
      dialog_id: dialog_id,
      date_sent: Math.floor(Date.now() / 1000),

      notification_type: '7'
    }});

    QB.chat.roster.remove(jid, function() {
      li.remove();
      isSectionEmpty(list);

      // delete chat section
      if (chat.length > 0) chat.remove();
      $('#capBox').removeClass('is-hidden');
      delete dialogs[dialog_id];
    });
    
  },

  // callbacks

  onSubscribe: function(id) {
    var html,
        contacts = ContactList.contacts,
        jid = QB.chat.helpers.getUserJid(id, QMCONFIG.qbAccount.appId),
        dialogItem = $('#requestsList .list-item[data-jid="'+jid+'"]'),
        notConfirmed = localStorage['QM.notConfirmed'] ? JSON.parse(localStorage['QM.notConfirmed']) : {};

    if (dialogItem.length > 0) return true;
    // update notConfirmed people list
    notConfirmed[id] = true;
    ContactList.saveNotConfirmed(notConfirmed);

    ContactList.add([id], null, function() {
      html = '<li class="list-item" data-jid="'+jid+'">';
      html += '<a class="contact l-flexbox" href="#">';
      html += '<div class="l-flexbox_inline">';
      // html += '<img class="contact-avatar avatar" src="'+(typeof contacts[id] !== 'undefined' ? contacts[id].avatar_url : '')+'" alt="user">';
      html += '<div class="contact-avatar avatar" style="background-image:url('+(typeof contacts[id] !== 'undefined' ? contacts[id].avatar_url : '')+')"></div>';
      html += '<span class="name">'+(typeof contacts[id] !== 'undefined' ? contacts[id].full_name : '')+'</span>';
      html += '</div><div class="request-controls l-flexbox">';
      html += '<button class="request-button request-button_cancel">&#10005;</button>';
      html += '<button class="request-button request-button_ok">&#10003;</button>';
      html += '</div></a></li>';

      $('#requestsList').removeClass('is-hidden').find('ul').prepend(html);
      $('#emptyList').addClass('is-hidden');
    }, 'subscribe');
  },

  onConfirm: function(id) {
    var roster = ContactList.roster,
        dialogItem = $('.presence-listener[data-id="'+id+'"]');

    // update roster
    roster[id] = {
      subscription: 'to',
      ask: null
    };
    ContactList.saveRoster(roster);

    dialogItem.find('.status').removeClass('status_request');
    dialogItem.removeClass('is-request');
  },

  onReject: function(id) {
    var dialogItem = $('.presence-listener[data-id="'+id+'"]'),
        jid = QB.chat.helpers.getUserJid(id, QMCONFIG.qbAccount.appId),
        request = $('#requestsList .list-item[data-jid="'+jid+'"]'),
        list = request && request.parents('ul'),
        roster = ContactList.roster,
        notConfirmed = localStorage['QM.notConfirmed'] ? JSON.parse(localStorage['QM.notConfirmed']) : {};

    // update roster
    roster[id] = {
      subscription: 'none',
      ask: null
    };
    ContactList.saveRoster(roster);

    // update notConfirmed people list
    delete notConfirmed[id];
    ContactList.saveNotConfirmed(notConfirmed);

    dialogItem.find('.status').removeClass('status_online').addClass('status_request');
    if (dialogItem.is('.l-chat'))
      dialogItem.addClass('is-request');
    if (request.length > 0) {
      QB.chat.roster.remove(jid, function() {
        request.remove();
        isSectionEmpty(list);
      });      
    }
    dialogItem.addClass('is-request');
  },

  onPresence: function(id, type) {
    var dialogItem = $('.presence-listener[data-id="'+id+'"]'),
        roster = ContactList.roster;
    
    // update roster
    if (typeof roster[id] === 'undefined') return true;
    roster[id].status = type ? false : true;
    ContactList.saveRoster(roster);

    if (type)
      dialogItem.find('.status').removeClass('status_online');
    else
      dialogItem.find('.status').addClass('status_online');
  }

};

/* Private
---------------------------------------------------------------------- */
function openPopup(objDom, type, dialog_id) {
  objDom.add('.popups').addClass('is-overlay');
  if (type) objDom.addClass(type).data('dialog', dialog_id);
  else objDom.removeClass('add').data('dialog', '');
}

function scrollbarContacts() {
  $('.scrollbarContacts').mCustomScrollbar({
    theme: 'minimal-dark',
    scrollInertia: 150,
    live: true
  });
}

function scrollbar(list, self) {
  list.mCustomScrollbar({
    theme: 'minimal-dark',
    scrollInertia: 150,
    callbacks: {
      onTotalScroll: function() {
        ajaxDownloading(list, self);
      },
      alwaysTriggerOffsets: false
    }
  });
}

// ajax downloading of data through scroll
function ajaxDownloading(list, self) {
  var page = parseInt(sessionStorage['QM.search.page']),
      allPages = parseInt(sessionStorage['QM.search.allPages']);

  if (page <= allPages) {
    self.createDataSpinner(list);
    ContactList.globalSearch(function(results) {
      createListResults(list, results, self);
    });
  }
}

function createListResults(list, results, self) {
  var roster = ContactList.roster,
      notConfirmed = localStorage['QM.notConfirmed'] ? JSON.parse(localStorage['QM.notConfirmed']) : {},
      item;

  if (results.length > 0) {
    results.forEach(function(contact) {
      var rosterItem = roster[contact.id];

      item = '<li class="list-item" data-jid="'+contact.user_jid+'">';
      item += '<a class="contact l-flexbox" href="#">';
      item += '<div class="l-flexbox_inline">';
      // item += '<img class="contact-avatar avatar" src="'+contact.avatar_url+'" alt="user">';
      item += '<div class="contact-avatar avatar" style="background-image:url('+contact.avatar_url+')"></div>';
      item += '<span class="name">'+contact.full_name+'</span>';
      item += '</div>';
      if (!rosterItem || (rosterItem && rosterItem.subscription === 'none' && !rosterItem.ask && !notConfirmed[contact.id])) {
        item += '<button class="send-request"><img class="icon-normal" src="images/icon-request.png" alt="request">';
        item += '<img class="icon-active" src="images/icon-request_active.png" alt="request"></button>';
      }
      if (rosterItem && rosterItem.subscription === 'none' && rosterItem.ask) {
        item += '<span class="send-request l-flexbox">Request Sent</span>';
      }
      item += '</a></li>';

      list.find('.mCSB_container').append(item);
      list.removeClass('is-hidden').siblings('.popup-elem').addClass('is-hidden');
    });
  } else {
    list.parents('.popup_search').find('.note').removeClass('is-hidden').siblings('.popup-elem').addClass('is-hidden');
  }

  self.removeDataSpinner();
}

function isSectionEmpty(list) {
  if (list.contents().length === 0)
    list.parent().addClass('is-hidden');

  if ($('#historyList ul').contents().length === 0)
      $('#historyList ul').parent().addClass('is-hidden');

  if ($('#requestsList').is('.is-hidden') &&
      $('#recentList').is('.is-hidden') &&
      $('#historyList').is('.is-hidden')) {
    
    $('#emptyList').removeClass('is-hidden');
  }
}

},{}],13:[function(require,module,exports){
/*
 * Q-municate chat application
 *
 * Dialog View Module
 *
 */

module.exports = DialogView;

var User, Dialog, Message, ContactList;

function DialogView(app) {
  this.app = app;
  User = this.app.models.User;
  Dialog = this.app.models.Dialog;
  Message = this.app.models.Message;
  ContactList = this.app.models.ContactList;
}

DialogView.prototype = {

  // QBChat handlers
  chatCallbacksInit: function() {
    var ContactListView = this.app.views.ContactList,
        MessageView = this.app.views.Message;

    QB.chat.onMessageListener = MessageView.onMessage;
    QB.chat.onContactListListener = ContactListView.onPresence;
    QB.chat.onSubscribeListener = ContactListView.onSubscribe;
    QB.chat.onConfirmSubscribeListener = ContactListView.onConfirm;
    QB.chat.onRejectSubscribeListener = ContactListView.onReject;

    QB.chat.onDisconnectingListener = function() {
      if (localStorage['QM.user']) {
        window.onLine = false;
        $('.no-connection').removeClass('is-hidden');
      }
    };

    QB.chat.onReconnectListener = function() {
      window.onLine = true;
      $('.no-connection').addClass('is-hidden');
    };
  },

  createDataSpinner: function(chat, groupchat) {
    var spinnerBlock;
    if (groupchat)
      spinnerBlock = '<div class="popup-elem spinner_bounce is-creating">';
    else
      spinnerBlock = '<div class="popup-elem spinner_bounce is-empty">';
    spinnerBlock += '<div class="spinner_bounce-bounce1"></div>';
    spinnerBlock += '<div class="spinner_bounce-bounce2"></div>';
    spinnerBlock += '<div class="spinner_bounce-bounce3"></div>';
    spinnerBlock += '</div>';

    if (chat) {
      $('.l-chat:visible').find('.l-chat-content').append(spinnerBlock);
    } else if (groupchat) {
      $('#popupContacts .btn_popup').addClass('is-hidden');
      $('#popupContacts .popup-footer').append(spinnerBlock);
      $('#popupContacts .popup-footer').after('<div class="temp-box"></div>');
    } else {
      $('#emptyList').after(spinnerBlock);
    }
  },

  removeDataSpinner: function() {
    $('.spinner_bounce, .temp-box').remove();
  },

  prepareDownloading: function(roster) {
    if (QMCONFIG.debug) console.log('QB SDK: Roster has been got', roster);
    this.chatCallbacksInit();
    this.createDataSpinner();
    scrollbar();
    ContactList.saveRoster(roster);
  },

  downloadDialogs: function(roster, ids) {
    var self = this,
        ContactListView = this.app.views.ContactList,
        hiddenDialogs = sessionStorage['QM.hiddenDialogs'] ? JSON.parse(sessionStorage['QM.hiddenDialogs']) : {},
        notConfirmed,
        private_id,
        dialog,
        occupants_ids,
        chat;

    Dialog.download(function(dialogs) {
      self.removeDataSpinner();

      if (dialogs.length > 0) {

        occupants_ids = _.uniq(_.flatten(_.pluck(dialogs, 'occupants_ids'), true));

        // updating of Contact List whereto are included all people 
        // with which maybe user will be to chat (there aren't only his friends)
        ContactList.add(occupants_ids, null, function() {

          for (var i = 0, len = dialogs.length; i < len; i++) {
            dialog = Dialog.create(dialogs[i]);
            ContactList.dialogs[dialog.id] = dialog;
            // if (QMCONFIG.debug) console.log('Dialog', dialog);

            if (!localStorage['QM.dialog-' + dialog.id]) {
              localStorage.setItem('QM.dialog-' + dialog.id, JSON.stringify({ messages: [] }));
            }

            // don't create a duplicate dialog in contact list
            chat = $('.l-list-wrap section:not(#searchList) .dialog-item[data-dialog="'+dialog.id+'"]');
            if (chat[0]) {
              chat.find('.unread').text(dialog.unread_count);
              continue;
            }

            if (dialog.type === 2) QB.chat.muc.join(dialog.room_jid);

            // update hidden dialogs
            private_id = dialog.type === 3 ? dialog.occupants_ids[0] : null;
            hiddenDialogs[private_id] = dialog.id;
            ContactList.saveHiddenDialogs(hiddenDialogs);

            // not show dialog if user has not confirmed this contact
            notConfirmed = localStorage['QM.notConfirmed'] ? JSON.parse(localStorage['QM.notConfirmed']) : {};
            if (private_id && (!roster[private_id] || (roster[private_id] && roster[private_id].subscription === 'none' && !roster[private_id].ask && notConfirmed[private_id])))
              continue;
            
            self.addDialogItem(dialog, true);
          }

          if ($('#requestsList').is('.is-hidden') &&
              $('#recentList').is('.is-hidden') &&
              $('#historyList').is('.is-hidden')) {
            
            $('#emptyList').removeClass('is-hidden');
          }

        });

      } else {
        $('#emptyList').removeClass('is-hidden');
      }

      // import FB friends
      if (ids) {
        ContactList.getFBFriends(ids, function(new_ids) {
          openPopup($('#popupImport'));
          for (var i = 0, len = new_ids.length; i < len; i++) {
            ContactListView.importFBFriend(new_ids[i]);
          }
        });
      }

    });
  },

  hideDialogs: function() {
    $('.l-list').addClass('is-hidden');
    $('.l-list ul').html('');
  },

  addDialogItem: function(dialog, isDownload, isNew) {
    var contacts = ContactList.contacts,
        roster = ContactList.roster,
        private_id, icon, name, status,
        html, startOfCurrentDay;

    private_id = dialog.type === 3 ? dialog.occupants_ids[0] : null;
    icon = private_id ? contacts[private_id].avatar_url : (dialog.room_photo || QMCONFIG.defAvatar.group_url);
    name = private_id ? contacts[private_id].full_name : dialog.room_name;
    status = roster[private_id] ? roster[private_id] : null;

    html = '<li class="list-item dialog-item presence-listener" data-dialog="'+dialog.id+'" data-id="'+private_id+'">';
    html += '<a class="contact l-flexbox" href="#">';
    html += '<div class="l-flexbox_inline">';
    // html += '<img class="contact-avatar avatar" src="' + icon + '" alt="user">';
    html += '<div class="contact-avatar avatar" style="background-image:url(' + icon + ')"></div>';
    html += '<span class="name">' + name + '</span>';
    html += '</div>';
    
    if (dialog.type === 3)
      html = getStatus(status, html);
    else
      html += '<span class="status"></span>';

    html += '<span class="unread">'+dialog.unread_count+'</span>';

    html += '</a></li>';

    startOfCurrentDay = new Date;
    startOfCurrentDay.setHours(0,0,0,0);

    // checking if this dialog is recent OR no
    if (!dialog.last_message_date_sent || new Date(dialog.last_message_date_sent * 1000) > startOfCurrentDay || isNew) {
      if (isDownload)
        $('#recentList').removeClass('is-hidden').find('ul').append(html);
      else if (!$('#searchList').is(':visible'))
        $('#recentList').removeClass('is-hidden').find('ul').prepend(html);
      else
        $('#recentList').removeClass('is-hidden').find('ul').prepend(html);
    } else if (!$('#searchList').is(':visible')) {
      $('#historyList').removeClass('is-hidden').find('ul').append(html);
    }

    $('#emptyList').addClass('is-hidden');
  },

  htmlBuild: function(objDom) {
    var MessageView = this.app.views.Message,
        contacts = ContactList.contacts,
        dialogs = ContactList.dialogs,
        roster = ContactList.roster,
        parent = objDom.parent(),
        dialog_id = parent.data('dialog'),
        user_id = parent.data('id'),
        dialog = dialogs[dialog_id],
        user = contacts[user_id],
        chat = $('.l-chat[data-dialog="'+dialog_id+'"]'),
        html, jid, icon, name, status, message,
        self = this;

    // if (QMCONFIG.debug) console.log(dialog);
    // if (QMCONFIG.debug) console.log(user);

    jid = dialog.room_jid || user.user_jid;
    icon = user_id ? user.avatar_url : (dialog.room_photo || QMCONFIG.defAvatar.group_url);
    name = dialog.room_name || user.full_name;
    status = roster[user_id] ? roster[user_id] : null;

    if (chat.length === 0) {
      if (dialog.type === 3) {
        html = '<section class="l-workspace l-chat l-chat_private presence-listener" data-dialog="'+dialog_id+'" data-id="'+user_id+'" data-jid="'+jid+'">';
        html += '<header class="l-chat-header l-flexbox l-flexbox_flexbetween">';
      } else {
        html = '<section class="l-workspace l-chat l-chat_group is-group" data-dialog="'+dialog_id+'" data-jid="'+jid+'">';
        html += '<header class="l-chat-header l-flexbox l-flexbox_flexbetween groupTitle">';
      }

      html += '<div class="chat-title">';
      html += '<div class="l-flexbox_inline">';
      html += '<div class="contact-avatar avatar avatar_chat" style="background-image:url('+icon+')"></div>';

      if (dialog.type === 3) {
        html += '<h2 class="name name_chat" title="'+name+'">'+name+'</h2>';
        html = getStatus(status, html); 
      } else {
        html += '<span class="pencil_active avatar is-hidden"></span>';
        html += '<input class="avatar_file avatar is-hidden" type="file" accept="image/*">'
        html += '<h2 class="name name_chat" contenteditable="true" title="'+name+'">'+name+'</h2>';
        html += '<span class="pencil is-hidden"></span>';
        html += '<span class="triangle triangle_down"></span>';
        html += '<span class="triangle triangle_up is-hidden"></span>';
      }

      html += '</div></div>';
      html += '<div class="chat-controls">';
      // html += '<button class="btn_chat btn_chat_videocall"><img src="images/icon-videocall.png" alt="videocall"></button>';
      // html += '<button class="btn_chat btn_chat_audiocall"><img src="images/icon-audiocall.png" alt="audiocall"></button>';
      if (dialog.type === 3)
        html += '<button class="btn_chat btn_chat_add createGroupChat" data-ids="'+dialog.occupants_ids.join()+'"><img src="images/icon-add.png" alt="add"></button>';
      else
        html += '<button class="btn_chat btn_chat_add addToGroupChat" data-ids="'+dialog.occupants_ids.join()+'" data-dialog="'+dialog_id+'"><img src="images/icon-add.png" alt="add"></button>';
      // html += '<button class="btn_chat btn_chat_profile"><img src="images/icon-profile.png" alt="profile"></button>';
      
      if (dialog.type === 3)
        html += '<button class="btn_chat btn_chat_delete deleteContact"><img src="images/icon-delete.png" alt="delete"></button>';
      else
        html += '<button class="btn_chat btn_chat_delete leaveChat"><img src="images/icon-delete.png" alt="delete"></button>';
      
      html += '</div></header>';

      // build occupants of room
      if (dialog.type === 2) {
        html += '<div class="chat-occupants-wrap">';
        html += '<div class="chat-occupants">';
        for (var i = 0, len = dialog.occupants_ids.length, id; i < len; i++) {
          id = dialog.occupants_ids[i];
          if (id != User.contact.id) {
            html += '<a class="occupant l-flexbox_inline presence-listener" data-id="'+id+'" href="#">';

            html = getStatus(roster[id], html);

            html += '<span class="name name_occupant">'+contacts[id].full_name+'</span>';
            html += '</a>';
          }
        }
        html += '</div></div>';
      }

      html += '<section class="l-chat-content scrollbar_message"></section>';
      html += '<footer class="l-chat-footer">';
      html += '<form class="l-message" action="#">';
      html += '<div class="form-input-message textarea" contenteditable="true" placeholder="Type a message"></div>';
      // html += '<textarea class="text-message is-hidden"></textarea>';
      html += '<button class="btn_message btn_message_smile"><img src="images/icon-smile.png" alt="smile"></button>';
      html += '<button class="btn_message btn_message_attach"><img src="images/icon-attach.png" alt="attach"></button>';
      html += '<input class="attachment" type="file">';
      html += '</form></footer>';
      html += '</section>';

      $('.l-workspace-wrap .l-workspace').addClass('is-hidden').parent().append(html);
      textAreaScrollbar();

      if (dialog.type === 3 && (!status || status.subscription === 'none'))
        $('.l-chat:visible').addClass('is-request');

      self.createDataSpinner(true);
      Message.download(dialog_id, function(messages) {
        self.removeDataSpinner();
        for (var i = 0, len = messages.length; i < len; i++) {
          message = Message.create(messages[i]);
          // if (QMCONFIG.debug) console.log(message);
          MessageView.addItem(message, null, null, message.recipient_id);
        }
        self.messageScrollbar();
      });

    } else {

      chat.removeClass('is-hidden').siblings().addClass('is-hidden');
      $('.l-chat:visible .scrollbar_message').mCustomScrollbar('destroy');
      self.messageScrollbar();

      // console.log(2222222);
      // console.log(self.app.models.ContactList.dialogs[dialog_id]);

      if (typeof dialog.messages !== 'undefined') {
        Message.update(dialog.messages.join(), dialog_id);
        dialog.messages = [];
      }
      
    }

    $('.is-selected').removeClass('is-selected');
    parent.addClass('is-selected').find('.unread').text('');
    
  },

  messageScrollbar: function() {
    var objDom = $('.l-chat:visible .scrollbar_message'),
        height = objDom[0].scrollHeight,
        self = this;

    objDom.mCustomScrollbar({
      theme: 'minimal-dark',
      scrollInertia: 1000,
      setTop: height + 'px',
      callbacks: {
        onTotalScrollBack: function() {
          ajaxDownloading(objDom, self);
        },
        alwaysTriggerOffsets: false
      }
    });
  },

  createGroupChat: function(type, dialog_id) {
    var contacts = ContactList.contacts,
        new_members = $('#popupContacts .is-chosen'),
        occupants_ids = $('#popupContacts').data('existing_ids') || [],
        groupName = occupants_ids.length > 0 ? [ User.contact.full_name, contacts[occupants_ids[0]].full_name ] : [User.contact.full_name],
        occupants_names = !type && occupants_ids.length > 0 ? [ contacts[occupants_ids[0]].full_name ] : [],
        self = this, new_ids = [], new_id, occupant,
        roster = ContactList.roster,
        chat = $('.l-chat[data-dialog="'+dialog_id+'"]');

    for (var i = 0, len = new_members.length, name; i < len; i++) {
      name = $(new_members[i]).find('.name').text();
      if (groupName.length < 3) groupName.push(name);
      occupants_names.push(name);
      occupants_ids.push($(new_members[i]).data('id').toString());
      new_ids.push($(new_members[i]).data('id').toString());
    }

    groupName = groupName.join(', ');
    occupants_names = occupants_names.join(', ');
    occupants_ids = occupants_ids.join();

    self.createDataSpinner(null, true);
    if (type) {
      Dialog.updateGroup(occupants_names, {dialog_id: dialog_id, occupants_ids: occupants_ids, new_ids: new_ids}, function(dialog) {
        self.removeDataSpinner();
        var dialogItem = $('.l-list-wrap section:not(#searchList) .dialog-item[data-dialog="'+dialog.id+'"]');
        if (dialogItem.length > 0) {
          copyDialogItem = dialogItem.clone();
          dialogItem.remove();
          $('#recentList ul').prepend(copyDialogItem);
          if (!$('#searchList').is(':visible')) {
           $('#recentList').removeClass('is-hidden');
           isSectionEmpty($('#recentList ul')); 
          }
        }
        // chat.find('.addToGroupChat').data('ids', dialog.occupants_ids);
        $('.is-overlay:not(.chat-occupants-wrap)').removeClass('is-overlay');


        // for (var i = 0, len = new_ids.length; i < len; i++) {
        //   new_id = new_ids[i];
        //   occupant = '<a class="occupant l-flexbox_inline presence-listener" data-id="'+new_id+'" href="#">';
        //   occupant = getStatus(roster[new_id], occupant);
        //   occupant += '<span class="name name_occupant">'+contacts[new_id].full_name+'</span></a>';
        //   chat.find('.chat-occupants-wrap .mCSB_container').append(occupant);
        // }

        // chat.find('.addToGroupChat').data('ids', dialog.occupants_ids);

        // $('.dialog-item[data-dialog="'+dialog.id+'"]').find('.contact').click();
      });
    } else {
      Dialog.createGroup(occupants_names, {name: groupName, occupants_ids: occupants_ids, type: 2}, function(dialog) {
        self.removeDataSpinner();
        $('.is-overlay').removeClass('is-overlay');
        $('.dialog-item[data-dialog="'+dialog.id+'"]').find('.contact').click();
      });
    }
  },

  leaveGroupChat: function(objDom) {
    var dialogs = ContactList.dialogs,
        dialog_id = objDom.data('dialog'),
        dialog = dialogs[dialog_id],
        li = $('.dialog-item[data-dialog="'+dialog_id+'"]'),
        chat = $('.l-chat[data-dialog="'+dialog_id+'"]'),
        list = li.parents('ul');

    Dialog.leaveChat(dialog, function() {
      li.remove();
      isSectionEmpty(list);

      // delete dialog messages
      localStorage.removeItem('QM.dialog-' + dialog_id);

      // delete chat section
      if (chat.length > 0) chat.remove();
      $('#capBox').removeClass('is-hidden');
      delete dialogs[dialog_id];
    });

  }

};

/* Private
---------------------------------------------------------------------- */
function scrollbar() {
  $('.l-sidebar .scrollbar').mCustomScrollbar({
    theme: 'minimal-dark',
    scrollInertia: 1000
  });
}

// ajax downloading of data through scroll
function ajaxDownloading(chat, self) {
  var MessageView = self.app.views.Message,
      dialog_id = chat.parents('.l-chat').data('dialog'),
      count = chat.find('.message').length,
      message;

  Message.download(dialog_id, function(messages) {
    for (var i = 0, len = messages.length; i < len; i++) {
      message = Message.create(messages[i]);
      // if (QMCONFIG.debug) console.log(message);
      MessageView.addItem(message, true);
    }
  }, count);
}

function openPopup(objDom) {
  objDom.add('.popups').addClass('is-overlay');
}

function getStatus(status, html) {
  if (!status || status.subscription === 'none')
    html += '<span class="status status_request"></span>';
  else if (status && status.status)
    html += '<span class="status status_online"></span>';
  else
    html += '<span class="status"></span>';

  return html;
}

function textAreaScrollbar() {
  $('.l-chat:visible .textarea').niceScroll({
    cursoropacitymax: 0.5,
    railpadding: {right: 5},
    zindex: 1,
    enablekeyboard: false
  });
}

function isSectionEmpty(list) {
  if (list.contents().length === 0)
    list.parent().addClass('is-hidden');

  if ($('#historyList ul').contents().length === 0)
      $('#historyList ul').parent().addClass('is-hidden');

  if ($('#requestsList').is('.is-hidden') &&
      $('#recentList').is('.is-hidden') &&
      $('#historyList').is('.is-hidden')) {
    
    $('#emptyList').removeClass('is-hidden');
  }
}

},{}],14:[function(require,module,exports){
/*
 * Q-municate chat application
 *
 * Message View Module
 *
 */

module.exports = MessageView;

var Session, User, Message, ContactList, Dialog;
var self;

function MessageView(app) {
  this.app = app;
  Session = this.app.models.Session;
  User = this.app.models.User;
  Dialog = this.app.models.Dialog;
  Message = this.app.models.Message;
  ContactList = this.app.models.ContactList;
  self = this;
}

MessageView.prototype = {

  // this needs only for group chats: check if user exist in group chat
  checkSenderId: function(senderId, callback) {
    if (senderId !== User.contact.id) {
      ContactList.add([senderId], null, function() {
        callback();
      });
    } else {
      callback();
    }
  },

  addItem: function(message, isCallback, isMessageListener, recipientId) {
    var DialogView = this.app.views.Dialog,
        ContactListMsg = this.app.models.ContactList,
        chat = $('.l-chat[data-dialog="'+message.dialog_id+'"]');

    if (typeof chat[0] === 'undefined' || (!message.body && !message.notification_type && !message.attachment)) return true;

    this.checkSenderId(message.sender_id, function() {

      var contacts = ContactListMsg.contacts,
          contact = message.sender_id === User.contact.id ? User.contact : contacts[message.sender_id],
          type = message.notification_type || 'message',
          attachType = message.attachment && message.attachment.type,
          recipient = contacts[recipientId] || null,
          html;

      switch (type) {
      case '1':
        html = '<article class="message message_service l-flexbox l-flexbox_alignstretch" data-id="'+message.sender_id+'" data-type="'+type+'">';
        html += '<span class="message-avatar contact-avatar_message request-button_pending"></span>';
        html += '<div class="message-container-wrap">';
        html += '<div class="message-container l-flexbox l-flexbox_flexbetween l-flexbox_alignstretch">';
        html += '<div class="message-content">';
        html += '<h4 class="message-author">'+contact.full_name+' has added '+message.body+' to the group chat</h4>';
        html += '</div><time class="message-time">'+getTime(message.date_sent)+'</time>';
        html += '</div></div></article>';
        break;

      case '2':
        html = '<article class="message message_service l-flexbox l-flexbox_alignstretch" data-id="'+message.sender_id+'" data-type="'+type+'">';
        html += '<span class="message-avatar contact-avatar_message request-button_pending"></span>';
        html += '<div class="message-container-wrap">';
        html += '<div class="message-container l-flexbox l-flexbox_flexbetween l-flexbox_alignstretch">';
        html += '<div class="message-content">';
        if (message.occupants_ids) {
          html += '<h4 class="message-author">'+contact.full_name+' has added '+message.body+'</h4>';
        }
        if (message.deleted_id) {
          html += '<h4 class="message-author">'+contact.full_name+' has left</h4>';
        }
        if (message.room_name) {
          html += '<h4 class="message-author">'+contact.full_name+' has changed the chat name to "'+message.room_name+'"</h4>';
        }
        if (message.room_photo) {
          html += '<h4 class="message-author">'+contact.full_name+' has changed the chat picture</h4>';
        }
        html += '</div><time class="message-time">'+getTime(message.date_sent)+'</time>';
        html += '</div></div></article>';
        break;

      case '3':
        html = '<article class="message message_service l-flexbox l-flexbox_alignstretch" data-id="'+message.sender_id+'" data-type="'+type+'">';
        html += '<span class="message-avatar contact-avatar_message request-button_pending"></span>';
        html += '<div class="message-container-wrap">';
        html += '<div class="message-container l-flexbox l-flexbox_flexbetween l-flexbox_alignstretch">';
        html += '<div class="message-content">';

        if (message.sender_id === User.contact.id)
          html += '<h4 class="message-author">Your request has been sent</h4>';
        else
          html += '<h4 class="message-author">'+contact.full_name+' has sent a request to you</h4>';

        html += '</div><time class="message-time">'+getTime(message.date_sent)+'</time>';
        html += '</div></div></article>';
        break;

      case '4':
        html = '<article class="message message_service l-flexbox l-flexbox_alignstretch" data-id="'+message.sender_id+'" data-type="'+type+'">';
        html += '<span class="message-avatar contact-avatar_message request-button_cancel">&#10005;</span>';
        html += '<div class="message-container-wrap">';
        html += '<div class="message-container l-flexbox l-flexbox_flexbetween l-flexbox_alignstretch">';
        html += '<div class="message-content">';

        if (message.sender_id === User.contact.id)
          html += '<h4 class="message-author">You have rejected a request';
        else
          html += '<h4 class="message-author">Your request has been rejected <button class="btn btn_request_again"><img class="btn-icon btn-icon_request" src="images/icon-request.png" alt="request">Send Request Again</button></h4>';
          

        html += '</div><time class="message-time">'+getTime(message.date_sent)+'</time>';
        html += '</div></div></article>';
        break;

      case '5':
        html = '<article class="message message_service l-flexbox l-flexbox_alignstretch" data-id="'+message.sender_id+'" data-type="'+type+'">';
        html += '<span class="message-avatar contact-avatar_message request-button_ok">&#10003;</span>';
        html += '<div class="message-container-wrap">';
        html += '<div class="message-container l-flexbox l-flexbox_flexbetween l-flexbox_alignstretch">';
        html += '<div class="message-content">';

        if (message.sender_id === User.contact.id)
          html += '<h4 class="message-author">You have accepted a request</h4>';
        else
          html += '<h4 class="message-author">Your request has been accepted</h4>';

        html += '</div><time class="message-time">'+getTime(message.date_sent)+'</time>';
        html += '</div></div></article>';
        break;

      case '6':
        html = '<article class="message message_service l-flexbox l-flexbox_alignstretch" data-id="'+message.sender_id+'" data-type="'+type+'">';
        html += '<span class="message-avatar contact-avatar_message request-button_pending"></span>';
        html += '<div class="message-container-wrap">';
        html += '<div class="message-container l-flexbox l-flexbox_flexbetween l-flexbox_alignstretch">';
        html += '<div class="message-content">';
        html += '<h4 class="message-author">'+contact.full_name+' has left</h4>';
        html += '</div><time class="message-time">'+getTime(message.date_sent)+'</time>';
        html += '</div></div></article>';
        break;

      case '7':
        html = '<article class="message message_service l-flexbox l-flexbox_alignstretch" data-id="'+message.sender_id+'" data-type="'+type+'">';
        html += '<span class="message-avatar contact-avatar_message request-button_pending"></span>';
        html += '<div class="message-container-wrap">';
        html += '<div class="message-container l-flexbox l-flexbox_flexbetween l-flexbox_alignstretch">';
        html += '<div class="message-content">';

        if (message.sender_id === User.contact.id)
          html += '<h4 class="message-author">You have deleted '+recipient.full_name+' from your contact list';
        else
          html += '<h4 class="message-author">You have been deleted from the contact list <button class="btn btn_request_again btn_request_again_delete"><img class="btn-icon btn-icon_request" src="images/icon-request.png" alt="request">Send Request Again</button></h4>';
          

        html += '</div><time class="message-time">'+getTime(message.date_sent)+'</time>';
        html += '</div></div></article>';
        break;

      default:
        if (message.sender_id === User.contact.id)
          html = '<article class="message is-own l-flexbox l-flexbox_alignstretch" data-id="'+message.sender_id+'" data-type="'+type+'">';
        else
          html = '<article class="message l-flexbox l-flexbox_alignstretch" data-id="'+message.sender_id+'" data-type="'+type+'">';

        // html += '<img class="message-avatar avatar contact-avatar_message" src="'+contact.avatar_url+'" alt="avatar">';
        html += '<div class="message-avatar avatar contact-avatar_message" style="background-image:url('+contact.avatar_url+')"></div>';
        html += '<div class="message-container-wrap">';
        html += '<div class="message-container l-flexbox l-flexbox_flexbetween l-flexbox_alignstretch">';
        html += '<div class="message-content">';
        html += '<h4 class="message-author">'+contact.full_name+'</h4>';

        if (attachType && attachType.indexOf('image') > -1) {

          html += '<div class="message-body">';
          html += '<div class="preview preview-photo" data-url="'+message.attachment.url+'" data-name="'+message.attachment.name+'" data-uid="'+message.attachment.uid+'">';
          html += '<img src="'+message.attachment.url+'" alt="attach">';
          html += '</div></div>';
          html += '</div><time class="message-time">'+getTime(message.date_sent)+'</time>';

        } else if (attachType && attachType.indexOf('audio') > -1) {

          html += '<div class="message-body">';
          html += message.attachment.name+'<br><br>';
          html += '<audio src="'+message.attachment.url+'" controls></audio>';
          html += '</div>';
          html += '</div><time class="message-time">'+getTime(message.date_sent)+' ';
          html += '<a href="'+getFileDownloadLink(message.attachment.uid)+'" download>Download</a></time>';

        } else if (attachType && attachType.indexOf('video') > -1) {

          html += '<div class="message-body">';
          html += message.attachment.name+'<br><br>';
          html += '<div class="preview preview-video" data-url="'+message.attachment.url+'" data-name="'+message.attachment.name+'" data-uid="'+message.attachment.uid+'"></div>';
          html += '</div>';
          html += '</div><time class="message-time">'+getTime(message.date_sent)+'</time>';

        } else if (attachType) {

          html += '<div class="message-body">';
          html += '<a class="attach-file" href="'+getFileDownloadLink(message.attachment.uid)+'" download>'+message.attachment.name+'</a>';
          html += '<span class="attach-size">'+getFileSize(message.attachment.size)+'</span>';
          html += '</div>';
          html += '</div><time class="message-time">'+getTime(message.date_sent)+' ';
          html += '<a href="'+getFileDownloadLink(message.attachment.uid)+'" download>Download</a></time>';

        } else {
          html += '<div class="message-body">'+minEmoji(parser(message.body))+'</div>';
          html += '</div><time class="message-time">'+getTime(message.date_sent)+'</time>';
        }

        html += '</div></div></article>';
        break;
      }

      // <div class="message-container l-flexbox l-flexbox_flexbetween l-flexbox_alignstretch">
      //                   <div class="message-content">
      //                     <div class="message-body">
      //                       <div class="preview preview-photo"><img src="images/test.jpg" alt="attach"></div>
      //                     </div>
      //                   </div>
      //                   <time class="message-time">30/05/2014</time>
      //                 </div>

      if (isCallback) {
        if (isMessageListener) {
          chat.find('.l-chat-content .mCSB_container').append(html);
          
          // fix for custom scroll
          fixScroll(chat);
        } else {
          chat.find('.l-chat-content .mCSB_container').prepend(html);
        }
      } else {
        chat.find('.l-chat-content').prepend(html);
      }

    });
    
  },

  sendMessage: function(form) {
    var jid = form.parents('.l-chat').data('jid'),
        id = form.parents('.l-chat').data('id'),
        dialog_id = form.parents('.l-chat').data('dialog'),
        val = form.find('.textarea').html().trim(),
        time = Math.floor(Date.now() / 1000),
        type = form.parents('.l-chat').is('.is-group') ? 'groupchat' : 'chat',
        dialogItem = type === 'groupchat' ? $('.l-list-wrap section:not(#searchList) .dialog-item[data-dialog="'+dialog_id+'"]') : $('.l-list-wrap section:not(#searchList) .dialog-item[data-id="'+id+'"]'),
        copyDialogItem;

    if (val.length > 0) {
      if (form.find('.textarea > span').length > 0) {
        form.find('.textarea > span').each(function() {
          $(this).after($(this).find('span').data('unicode')).remove();
        });
        val = form.find('.textarea').text().trim();
      }
      
      // send message
      QB.chat.send(jid, {type: type, body: val, extension: {
        save_to_history: 1,
        dialog_id: dialog_id,
        date_sent: time,

        full_name: User.contact.full_name,
        avatar_url: User.contact.avatar_url
      }});

      message = Message.create({
        chat_dialog_id: dialog_id,
        body: val,
        date_sent: time,
        sender_id: User.contact.id
      });
      if (QMCONFIG.debug) console.log(message);
      if (type === 'chat') self.addItem(message, true, true);

      if (dialogItem.length > 0) {
        copyDialogItem = dialogItem.clone();
        dialogItem.remove();
        $('#recentList ul').prepend(copyDialogItem);
        if (!$('#searchList').is(':visible')) {
         $('#recentList').removeClass('is-hidden');
         isSectionEmpty($('#recentList ul')); 
        }
      }
    }
  },

  onMessage: function(id, message, recipientJid, isOfflineStorage) {
    if (message.type === 'error') return true;

    var DialogView = self.app.views.Dialog,
        hiddenDialogs = sessionStorage['QM.hiddenDialogs'] ? JSON.parse(sessionStorage['QM.hiddenDialogs']) : {},
        dialogs = ContactList.dialogs,
        notification_type = message.extension && message.extension.notification_type,
        dialog_id = message.extension && message.extension.dialog_id,
        room_jid = message.extension && message.extension.room_jid,
        room_name = message.extension && message.extension.room_name,
        room_photo = message.extension && message.extension.room_photo,
        deleted_id = message.extension && message.extension.deleted_id,
        occupants_ids = message.extension && message.extension.occupants_ids && message.extension.occupants_ids.split(',').map(Number),
        dialogItem = message.type === 'groupchat' ? $('.l-list-wrap section:not(#searchList) .dialog-item[data-dialog="'+dialog_id+'"]') : $('.l-list-wrap section:not(#searchList) .dialog-item[data-id="'+id+'"]'),
        dialogGroupItem = $('.l-list-wrap section:not(#searchList) .dialog-item[data-dialog="'+dialog_id+'"]'),
        chat = message.type === 'groupchat' ? $('.l-chat[data-dialog="'+dialog_id+'"]') : $('.l-chat[data-id="'+id+'"]'),
        unread = parseInt(dialogItem.length > 0 && dialogItem.find('.unread').text().length > 0 ? dialogItem.find('.unread').text() : 0),
        roster = ContactList.roster,
        audioSignal = $('#new_message')[0],
        recipientId = QB.chat.helpers.getIdFromNode(recipientJid),
        msg, copyDialogItem, dialog, occupant, msgArr;

    msg = Message.create(message);
    msg.sender_id = id;

    if ((!deleted_id || msg.sender_id !== User.contact.id) && chat.is(':visible')) {
      Message.update(msg.id, dialog_id);
    } else if (!chat.is(':visible') && chat.length > 0) {
      msgArr = dialogs[dialog_id].messages || [];
      msgArr.push(msg.id);
      dialogs[dialog_id].messages = msgArr;
    }

    if (!chat.is(':visible') && dialogItem.length > 0 && notification_type !== '1') {
      unread++;
      dialogItem.find('.unread').text(unread);
    }

    // create new group chat
    if (notification_type === '1' && message.type === 'chat' && dialogGroupItem.length === 0) {
      dialog = Dialog.create({
        _id: dialog_id,
        type: 2,
        occupants_ids: occupants_ids,
        name: room_name,
        xmpp_room_jid: room_jid,
        unread_count: 1
      });
      ContactList.dialogs[dialog.id] = dialog;
      if (QMCONFIG.debug) console.log('Dialog', dialog);
      if (!localStorage['QM.dialog-' + dialog.id]) {
        localStorage.setItem('QM.dialog-' + dialog.id, JSON.stringify({ messages: [] }));
      }

      ContactList.add(dialog.occupants_ids, null, function() {
        // don't create a duplicate dialog in contact list
        dialogItem = $('.l-list-wrap section:not(#searchList) .dialog-item[data-dialog="'+dialog.id+'"]')[0];
        if (dialogItem) return true;

        QB.chat.muc.join(room_jid);

        DialogView.addDialogItem(dialog);
        unread++;
        dialogGroupItem = $('.l-list-wrap section:not(#searchList) .dialog-item[data-dialog="'+dialog_id+'"]');
        dialogGroupItem.find('.unread').text(unread);
      });
    }

    // subscribe message
    if (notification_type === '3') {
      // update hidden dialogs
      hiddenDialogs[id] = dialog_id;
      ContactList.saveHiddenDialogs(hiddenDialogs);
    }

    // delete occupant
    if (notification_type === '6') {
      chat.find('.occupant[data-id="'+id+'"]').remove();
    }

    // add new occupants
    if (notification_type === '2') {
      dialog = ContactList.dialogs[dialog_id];
      if (occupants_ids && msg.sender_id !== User.contact.id) dialog.occupants_ids = dialog.occupants_ids.concat(occupants_ids);
      if (dialog && deleted_id) dialog.occupants_ids = _.compact(dialog.occupants_ids.join().replace(deleted_id, '').split(',')).map(Number);
      if (room_name) dialog.room_name = room_name;
      if (room_photo) dialog.room_photo = room_photo;
      if (dialog) ContactList.dialogs[dialog_id] = dialog;
      
      // add new people
      if (occupants_ids) {
        ContactList.add(dialog.occupants_ids, null, function() {
          var ids = chat.find('.addToGroupChat').data('ids') ? chat.find('.addToGroupChat').data('ids').toString().split(',').map(Number) : [],
              new_ids = _.difference(dialog.occupants_ids, ids),
              contacts = ContactList.contacts,
              new_id;
          
          for (var i = 0, len = new_ids.length; i < len; i++) {
            new_id = new_ids[i];
            if (new_id !== User.contact.id.toString()) {
              occupant = '<a class="occupant l-flexbox_inline presence-listener" data-id="'+new_id+'" href="#">';
              occupant = getStatus(roster[new_id], occupant);
              occupant += '<span class="name name_occupant">'+contacts[new_id].full_name+'</span></a>';
              chat.find('.chat-occupants-wrap .mCSB_container').append(occupant);
            }
          }

          chat.find('.addToGroupChat').data('ids', dialog.occupants_ids);
        });
      }

      // delete occupant
      if (deleted_id && msg.sender_id !== User.contact.id) {
        chat.find('.occupant[data-id="'+id+'"]').remove();
        chat.find('.addToGroupChat').data('ids', dialog.occupants_ids);
      }

      // change name
      if (room_name) {
        chat.find('.name_chat').text(room_name).attr('title', room_name);
        dialogItem.find('.name').text(room_name);
      }

      // change photo
      if (room_photo) {
        chat.find('.avatar_chat').css('background-image', 'url('+room_photo+')');
        dialogItem.find('.avatar').css('background-image', 'url('+room_photo+')');
      }
    }

    if (notification_type !== '1' && dialogItem.length > 0 && !isOfflineStorage) {
      copyDialogItem = dialogItem.clone();
      dialogItem.remove();
      $('#recentList ul').prepend(copyDialogItem);
      if (!$('#searchList').is(':visible')) {
       $('#recentList').removeClass('is-hidden');
       isSectionEmpty($('#recentList ul')); 
      }
    }

    if (QMCONFIG.debug) console.log(msg);
    self.addItem(msg, true, true, recipientId);
    audioSignal.play();
  }

};

/* Private
---------------------------------------------------------------------- */
function getStatus(status, html) {
  if (!status || status.subscription === 'none')
    html += '<span class="status status_request"></span>';
  else if (status && status.status)
    html += '<span class="status status_online"></span>';
  else
    html += '<span class="status"></span>';

  return html;
}

function getFileSize(size) {
  return size > (1024 * 1024) ? (size / (1024 * 1024)).toFixed(1) + ' MB' : (size / 1024).toFixed(1) + 'KB';
}

function getFileDownloadLink(uid) {
  return 'https://api.quickblox.com/blobs/'+uid+'?token='+Session.token;
}

function fixScroll(chat) {
  var containerHeight = chat.find('.l-chat-content .mCSB_container').height(),
      chatContentHeight = chat.find('.l-chat-content').height(),
      draggerContainerHeight = chat.find('.l-chat-content .mCSB_draggerContainer').height(),
      draggerHeight = chat.find('.l-chat-content .mCSB_dragger').height();

  chat.find('.l-chat-content .mCSB_container').css({top: chatContentHeight - containerHeight + 'px'});
  chat.find('.l-chat-content .mCSB_dragger').css({top: draggerContainerHeight - draggerHeight + 'px'});
}

function getTime(time) {
  var messageDate = new Date(time * 1000),
      startOfCurrentDay = new Date;

  startOfCurrentDay.setHours(0,0,0,0);

  if (messageDate > startOfCurrentDay) {
    return messageDate.getHours() + ':' + (messageDate.getMinutes().toString().length === 1 ? '0'+messageDate.getMinutes() : messageDate.getMinutes());
  } else if (messageDate.getFullYear() === startOfCurrentDay.getFullYear()) {
    return $.timeago(messageDate);
  } else {
    return messageDate.getDate() + '/' + (messageDate.getMonth() + 1) + '/' + messageDate.getFullYear();
  }
}

function parser(str) {
  var url, url_text;
  var URL_REGEXP = /\b((?:https?:\/\/|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/gi;
  
  str = escapeHTML(str);
  
  // parser of paragraphs
  str = str.replace(/\n/g, '<br>');
  
  // parser of links
  str = str.replace(URL_REGEXP, function(match) {
    url = (/^[a-z]+:/i).test(match) ? match : 'http://' + match;
    url_text = match;
    return '<a href="' + escapeHTML(url) + '" target="_blank">' + escapeHTML(url_text) + '</a>';
  });
  
  return str;
  
  function escapeHTML(s) {
    return s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}

function isSectionEmpty(list) {
  if (list.contents().length === 0)
    list.parent().addClass('is-hidden');

  if ($('#historyList ul').contents().length === 0)
      $('#historyList ul').parent().addClass('is-hidden');

  if ($('#requestsList').is('.is-hidden') &&
      $('#recentList').is('.is-hidden') &&
      $('#historyList').is('.is-hidden')) {
    
    $('#emptyList').removeClass('is-hidden');
  }
}

},{}],15:[function(require,module,exports){
/*
 * Q-municate chat application
 *
 * User View Module
 *
 */

module.exports = UserView;

var User, ContactList,
    FBCallback = null;

function UserView(app) {
  this.app = app;
  User = this.app.models.User;
  ContactList = this.app.models.ContactList;
}

UserView.prototype = {

  signupQB: function() {
    switchPage($('#signUpPage'));
  },

  loginQB: function() {
    switchPage($('#loginPage'));
  },

  forgot: function() {
    switchPage($('#forgotPage'));
  },

  connectFB: function(token) {
    User.connectFB(token);
  },

  signupForm: function() {
    clearErrors();
    User.signup();
  },

  loginForm: function() {
    clearErrors();
    User.login();
  },

  forgotForm: function() {
    clearErrors();
    User.forgot();
  },

  resetForm: function() {
    clearErrors();
    User.resetPass();
  },

  autologin: function() {
    switchPage($('#loginPage'));
    User.autologin();
  },

  createSpinner: function() {
    var spinnerBlock = '<div class="l-spinner"><div class="spinner">';
    spinnerBlock += '<div class="spinner-dot1"></div><div class="spinner-dot2"></div>';
    spinnerBlock += '</div></div>';

    $('section:visible form').addClass('is-hidden').after(spinnerBlock);
  },

  removeSpinner: function() {
    $('section:visible form').removeClass('is-hidden').next('.l-spinner').remove();
  },

  successFormCallback: function() {
    this.removeSpinner();
    // $('#profile').find('img').attr('src', User.contact.avatar_url);
    $('#profile').find('.avatar').css('background-image', "url("+User.contact.avatar_url+")");
    switchPage($('#mainPage'));
  },

  successSendEmailCallback: function() {
    var alert = '<div class="note l-form l-flexbox l-flexbox_column">';
    alert += '<span class="text text_alert text_alert_success">Success!</span>';
    alert += '<span class="text">Please check your email and click a link in the letter in order to reset your password</span>';
    alert += '</div>';

    this.removeSpinner();
    $('section:visible form').addClass('is-hidden').after(alert);
  },

  getFBStatus: function(callback) {
    if (typeof FB === 'undefined') {
      // Wait until FB SDK will be downloaded and then calling this function again
      FBCallback = callback;
      sessionStorage.setItem('QM.is_getFBStatus', true);
      return false;
    } else {
      callback = callback || FBCallback;
      FBCallback = null;

      FB.getLoginStatus(function(response) {
        if (QMCONFIG.debug) console.log('FB status response', response);
        if (callback) {
          // situation when you are recovering QB session via FB
          // and FB accessToken has expired
          if (response.status === 'connected') {
            callback(response.authResponse.accessToken);
          } else {
            FB.login(function(response) {
              if (QMCONFIG.debug) console.log('FB authResponse', response);
              if (response.status === 'connected')
                callback(response.authResponse.accessToken);
            });
          }
        }
      }, true);
    }
  },

  profilePopover: function(objDom) {
    var html = '<ul class="list-actions list-actions_profile popover">';
    // html += '<li class="list-item"><a class="list-actions-action" href="#">Profile</a></li>';
    html += '<li class="list-item"><a id="logout" class="list-actions-action" href="#">Log Out</a></li>';
    html += '</ul>';

    objDom.after(html);
    appearAnimation();
  },

  contactPopover: function(objDom) {
    var ids = objDom.parent().data('id'),
        dialog_id = objDom.parent().data('dialog'),
        roster = ContactList.roster,
        dialogs = ContactList.dialogs,
        html;

    html = '<ul class="list-actions list-actions_contacts popover">';
    
    // html += '<li class="list-item"><a class="list-actions-action" href="#">Video call</a></li>';
    // html += '<li class="list-item"><a class="list-actions-action" href="#">Audio call</a></li>';
    
    if (dialogs[dialog_id].type === 3 && roster[ids] && roster[ids].subscription !== 'none')
      html += '<li class="list-item"><a class="list-actions-action createGroupChat" data-ids="'+ids+'" href="#">Add people</a></li>';
    else if (dialogs[dialog_id].type !== 3)
      html += '<li class="list-item"><a class="list-actions-action addToGroupChat" data-group="true" data-ids="'+dialogs[dialog_id].occupants_ids+'" data-dialog="'+dialog_id+'" href="#">Add people</a></li>';
    
    // html += '<li class="list-item"><a class="list-actions-action" href="#">Profile</a></li>';
    
    if (dialogs[dialog_id].type === 3)
      html += '<li class="list-item"><a class="deleteContact list-actions-action" href="#">Delete contact</a></li>';
    else
      html += '<li class="list-item"><a class="leaveChat list-actions-action" data-group="true" href="#">Leave chat</a></li>';
    
    html += '</ul>';

    objDom.after(html).parent().addClass('is-contextmenu');
    appearAnimation();
  },

  occupantPopover: function(objDom, e) {
    var html,
        id = objDom.data('id'),
        jid = QB.chat.helpers.getUserJid(id, QMCONFIG.qbAccount.appId),
        roster = ContactList.roster,
        position = e.currentTarget.getBoundingClientRect();

    html = '<ul class="list-actions list-actions_occupants popover">';
    if (!roster[id] || (roster[id].subscription === 'none' && !roster[id].ask)) {
      html += '<li class="list-item" data-jid="'+jid+'"><a class="list-actions-action requestAction" data-id="'+id+'" href="#">Send request</a></li>';
    } else {
      // html += '<li class="list-item"><a class="list-actions-action" href="#">Video call</a></li>';
      // html += '<li class="list-item"><a class="list-actions-action" href="#">Audio call</a></li>';
      html += '<li class="list-item"><a class="list-actions-action writeMessage" data-id="'+id+'" href="#">Write message</a></li>';
      // html += '<li class="list-item"><a class="list-actions-action" href="#">Profile</a></li>';
    }
    html += '</ul>';

    $('body').append(html);
    appearAnimation();

    objDom.addClass('is-active');
    $('.list-actions_occupants').offset({top: position.top, left: position.left});
  },

  smilePopover: function(objDom) {
    if (objDom.find('img').length === 1)
      objDom.addClass('is-active').append('<img src="images/icon-smile_active.png" alt="smile">').find('*:first').addClass('is-hidden');
    
    $('.popover_smile').show(150);
  },

  logout: function() {
    User.logout(function() {
      switchOnWelcomePage();
      $('#capBox').removeClass('is-hidden');
      $('.l-chat').remove();
      if (QMCONFIG.debug) console.log('current User and Session were destroyed');
    });
  },

  localSearch: function(form) {
    var val = form.find('input[type="search"]').val().trim().toLowerCase();
    
    if (val.length > 0) {
      // if (QMCONFIG.debug) console.log('local search =', val);
      $('#searchList').removeClass('is-hidden').siblings('section').addClass('is-hidden');
      $('#searchList ul').html('').add('#searchList .note').removeClass('is-hidden');

      $('#recentList, #historyList').find('.dialog-item').each(function() {
        var name = $(this).find('.name').text().toLowerCase(),
            li = $(this).clone();

        if (name.indexOf(val) > -1) {
          $('#searchList ul').append(li);
          $('#searchList .note').addClass('is-hidden');
        }
        
      });

      if ($('#searchList ul').find('li').length === 0)
        $('#searchList .note').removeClass('is-hidden').siblings('ul').addClass('is-hidden');
      
    } else {
      $('#searchList').addClass('is-hidden');
      $('#recentList, #historyList, #requestsList').each(function() {
        if ($(this).find('.list-item').length > 0)
          $(this).removeClass('is-hidden');
      });
      if ($('.l-list-wrap section:not(#searchList) .list-item').length === 0)
        $('#emptyList').removeClass('is-hidden');
    }
  },

  friendsSearch: function(form) {
    var val = form.find('input[type="search"]').val().trim().toLowerCase(),
        result = form.next();
    
    result.find('ul').removeClass('is-hidden').siblings().addClass('is-hidden');
    result.find('ul li').removeClass('is-hidden');

    if (val.length > 0) {
      result.find('ul li').each(function() {
        var name = $(this).find('.name').text().toLowerCase(),
            li = $(this);

        if (name.indexOf(val) === -1)
          li.addClass('is-hidden');
      });

      if (result.find('ul li:visible').length === 0)
        result.find('.note').removeClass('is-hidden').siblings().addClass('is-hidden');
    }
  }

};

/* Private
---------------------------------------------------------------------- */
var clearErrors = function() {
  $('.is-error').removeClass('is-error');
};

var switchPage = function(page) {
  $('body').removeClass('is-welcome');
  page.removeClass('is-hidden').siblings('section').addClass('is-hidden');

  // reset form
  clearErrors();
  $('.no-connection').addClass('is-hidden');
  page.find('input').val('');
  if (!page.is('#mainPage')) {
    page.find('form').removeClass('is-hidden').next('.l-form').remove(); // reset Forgot form after success sending of letter
    // page.find('input:file').prev().find('img').attr('src', QMCONFIG.defAvatar.url).siblings('span').text(QMCONFIG.defAvatar.caption);
    page.find('input:file').prev().find('.avatar').css('background-image', "url("+QMCONFIG.defAvatar.url+")").siblings('span').text(QMCONFIG.defAvatar.caption);
    page.find('input:checkbox').prop('checked', false);
  }
};

var switchOnWelcomePage = function() {
  $('body').addClass('is-welcome');
  $('#welcomePage').removeClass('is-hidden').siblings('section').addClass('is-hidden');
};

var appearAnimation = function() {
  $('.popover:not(.popover_smile)').show(150);
};

},{}]},{},[1])