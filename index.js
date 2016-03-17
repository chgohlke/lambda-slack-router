'use strict';

var ArgParser = require('./lib/arg-parser');
var qs = require('qs');

var Utils = {
  buildResponse: function (response_type, response) {
    var modifiedResponse = response;
    if (typeof response === 'string') {
      return { response_type: response_type, text: response };
    }
    modifiedResponse.response_type = response_type;
    return modifiedResponse;
  },

  splitCommand: function (command) {
    var split = command.split(' ');
    return { commandName: split[0], args: split.slice(1) };
  }
};

// wraps logic around routing
function SlackBot(config) {
  this.config = config;
  this.commands = {};
}

// add a command
SlackBot.prototype.addCommand = function (command, desc, callback) {
  var args = [];
  var commandName = command;

  if (command instanceof Array) {
    args = command.slice(1);
    commandName = command[0];
  }

  this[commandName] = callback;
  this.commands[commandName] = { args: args, desc: desc };
};

// call a stored command
SlackBot.prototype.callCommand = function (commandName, options, callback) {
  var args;
  var modifiedOptions = options;

  if (!this.commands.hasOwnProperty(commandName)) {
    return this.help(options, callback);
  }
  args = ArgParser.align(this.commands[commandName].args, options.args || []);
  if (args !== false) {
    modifiedOptions.args = args;
    return this[commandName](modifiedOptions, callback);
  }
  return this.help(options, callback);
};

// respond to the whole channel
SlackBot.prototype.inChannelResponse = function (response) {
  return Utils.buildResponse('in_channel', response);
};

// respond to just the requesting user
SlackBot.prototype.ephemeralResponse = function (response) {
  return Utils.buildResponse('ephemeral', response);
};

// respond with a usage message
SlackBot.prototype.help = function (options, callback) {
  var helpText = '';

  Object.keys(this.commands).forEach(function (command) {
    helpText += command;
    if (this.commands[command].args.length) {
      helpText += ' ' + this.commands[command].args.join(' ');
    }
    helpText += ': ' + this.commands[command].desc + '\n';
  }.bind(this));
  helpText += 'help: display this help message';

  callback(null, this.ephemeralResponse({
    text: 'Available commands:',
    attachments: [{ text: helpText }]
  }));
};

// control the flow of queries from slack
SlackBot.prototype.buildRouter = function () {
  return function (event, context) {
    var body = qs.parse(event.body);
    var token = this.config.token;
    var split;

    if (!body.token || body.token !== token) {
      return context.done(this.ephemeralResponse('Invalid Slack token'));
    }

    split = Utils.splitCommand(body.text);
    if (split.commandName === 'help' || !this.commands.hasOwnProperty(split.commandName)) {
      return this.help({}, context.done);
    }

    return this.callCommand(split.commandName, {
      userName: body.user_name,
      args: split.args
    }, context.done);
  }.bind(this);
};

module.exports = SlackBot;
