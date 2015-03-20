# Trustroots Development Vagrant setup
#
# Requires https://github.com/smdahlen/vagrant-hostmanager
#
# https://www.vagrantup.com/

Vagrant.configure("2") do |config|

  config.hostmanager.enabled = true
  config.hostmanager.manage_host = true
  config.hostmanager.ignore_private_ip = false
  config.hostmanager.include_offline = true

  #config.vm.box = "arvindr21/mean-box"

  config.vm.box = "phusion-open-ubuntu-14.04-amd64"
  config.vm.box_url = "https://oss-binaries.phusionpassenger.com/vagrant/boxes/latest/ubuntu-14.04-amd64-vbox.box"

  config.vm.provider :vmware_fusion do |f, override|
    override.vm.box_url = "https://oss-binaries.phusionpassenger.com/vagrant/boxes/latest/ubuntu-14.04-amd64-vmwarefusion.box"
  end

  config.vm.provider "virtualbox" do |v|
    v.name = "Trustroots"
  end

  config.vm.network "private_network", ip: "192.168.33.10"
  config.vm.hostname = "trustroots.dev"

  config.vm.provision :shell, :path => "scripts/vagrantup/vagrantup.sh", :keep_color => true

  config.vm.synced_folder ".", "/srv/trustroots", :mount_options => ["dmode=777", "fmode=755"]

end
