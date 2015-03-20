# Running Trustroots with Vagrant

## Prerequisites
* A GNU/Linux or OS X machine.
* Install [VirtualBox](https://www.virtualbox.org/) ([...because](http://docs.vagrantup.com/v2/virtualbox))
* Install [Vagrant](https://www.vagrantup.com/) ([docs](https://docs.vagrantup.com/v2/installation/))
* Make sure you have [`git`](http://git-scm.com/) installed on your system.


## Install
1. Clone the repository: `git clone https://github.com/Trustroots/trustroots.git trustroots && cd trustroots`
2. Type `bash scripts/setup-vagrant.sh`.
3. Install will ask for your password to add "trustroots.dev" to your hosts file.
To skip this and use [http://192.168.33.10/](http://192.168.33.10/) instead,
set `config.hostmanager.enabled = false` at [Vagrant file](Vagrantfile) and change domain also to `scripts/vagrantup/nginx_trustroots_dev.conf`.
You can [modify your sudoers file](https://github.com/smdahlen/vagrant-hostmanager#passwordless-sudo)
to stop Vagrant asking for password each time.
4. Open [http://trustroots.dev/](http://trustroots.dev/) in your browser.

You can login with username `trout` and password `password`.

After setup your virtual machine is running. Suspend the virtual machine by typing `vagrant suspend`.
When you're ready to begin working again, just run `vagrant up`.

### Vagrant box
We're using [Phusion open](https://github.com/phusion/open-vagrant-boxes) Ubuntu 14.04 basebox.

During the first up `scripts/vagrantup/vagrantup.sh` installs these:
- Nginx
- NodeJS
- NPM
- MongoDB
- Phusion Passenger
- Grunt
- Gulp
- Bower
- Yeoman
- Generator-meanjs

#### SSH into Vagrant
```bash
vagrant ssh
```

#### Clean Vagrant box
If for some reason you want to have clean box & database, run:
```bash
vagrant destroy && vagrant up
```

#### Update Vagrant box
Although not necessary, if you want to check for updates, just type:
```bash
vagrant box outdated
```

It will tell you if you are running the latest version or not of the box. If it says you aren't, simply run:
```bash
vagrant box update
```
