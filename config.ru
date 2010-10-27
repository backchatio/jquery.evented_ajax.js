require "server"
set :env, :production
set :public, File.dirname(__FILE__) + '/public'
disable :run, :reload
run Sinatra::Application