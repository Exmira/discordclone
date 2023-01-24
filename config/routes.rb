Rails.application.routes.draw do
  get 'profiles/show'
  resources :messages
  devise_for :users
  resources :rooms
  get 'home/index'
  resources :users, only: [:show]
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Defines the root path route ("/")
 root "rooms#index"
end
