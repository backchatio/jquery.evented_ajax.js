require 'rubygems'
require 'em-websocket'
require 'sinatra/base'
require 'thin'
require 'json'

EventMachine.run do  
  @@channel = EM::Channel.new
  
  class App < Sinatra::Base
    set :public, File.dirname(__FILE__) + '/public'
    
    DELAY = 3
    
    get '/' do
      erb :index
    end
    
    post '/api/user/' do
      puts params.to_json
      
      clientMsgId = params[:clientMsgId]
      
      if(params[:username] == "existinguser")
        # Simulate error cases
        EM.add_timer(DELAY) {
          @@channel.push({ :event => "UserExists", :clientMsgId => clientMsgId, :timestamp => Time.now }.to_json)
        }
      else
        # This would be a successful request and response
        EM.add_timer(DELAY) {
          @@channel.push({ :event => "UserCreated", :clientMsgId => clientMsgId, :timestamp => Time.now }.to_json)
        }
      end
      
      # Ack the Ajax request
      { :requestQueued => true, :url => "/api/user", :clientMsgId => clientMsgId }.to_json
    end
  end

  EventMachine::WebSocket.start(:host => '0.0.0.0', :port => 8080) do |ws|
    @sid = nil
    
    ws.onopen {
      @sid = @@channel.subscribe { |msg| ws.send msg }
      @@channel.push({ :sid => @sid, :event => "connected", :timestamp => Time.now }.to_json)
    }
    
    ws.onclose   {
      ws.send({ :sid => @sid, :event => "closed", :timestamp => Time.now }.to_json)
      @@channel.unsubscribe(@sid)
    }
  end
  
  App.run!
end