# Running Trustroots with Vagrant

This Vagrant box is excellent for testing your code in environment that's very similar to our production server.

## Prerequisites
* A GNU/Linux or OS X machine.
* Install [VirtualBox](https://www.virtualbox.org/) ([...because](http://docs.vagrantup.com/v2/virtualbox))
* Install [Vagrant](https://www.vagrantup.com/) ([docs](https://docs.vagrantup.com/v2/installation/))
* Make sure you have [`git`](http://git-scm.com/) installed on your system.

## Install
1. Clone the repository: `git clone https://github.com/Trustroots/trustroots.git trustroots && cd trustroots`
2. Type `bash scripts/vagrant-setup.sh`.
3. Install will ask for your password to add "trustroots.dev" to your hosts file.
4. Open [http://trustroots.dev/](http://trustroots.dev/) in your browser.

You can login with username `trout` and password `password`.

After the setup your virtual machine is running and Grunt is watching any changes.

To stop Grunt watching files, hit `ctrl+c`. This will leave machine still running. To suspend the virtual machine, type `vagrant suspend`.

#### Development with Passenger
When you're ready to begin working again, just run `vagrant up`.

To enable Grunt watch again, run:
```bash
vagrant ssh -c "cd /srv/trustroots && grunt watch"
```

Or instead of watching just compile your files once, run:
```bash
vagrant ssh -c "cd /srv/trustroots && grunt build"
```

To read stdout logs:
```bash
vagrant ssh -c "tail -F /var/log/nginx/error.log"
```

Note that because of Passenger running inside the box, you might experience quite sticky cache for all the files (even backend) and Passenger spawning multiple processes.

If you don't see your file changes, you can go around this by letting Passenger to [restart application on every request](https://github.com/phusion/passenger/wiki/Phusion-Passenger%3A-Node.js-tutorial#restarting-your-application-on-every-request):
>To activate this mechanism, create the file `tmp/always_restart.txt`. As long as the file exists, Passenger will restart your application on every request.

However, this might slow page loading significantly. To manually restart Passenger, you can run `passenger-config restart-app` or `touch /srv/trustroots/tmp/restart.txt`. Also restarting Nginx works (`sudo service nginx restart`). All this inside the Vagrant box of course, or by passing `vagrant ssh -c "your_command"`.

#### SSH into Vagrant
```bash
vagrant ssh
```

##### Some useful file locations:
- `/srv/trustroots/` - The app
- `/etc/nginx/sites-enabled/trustroots_dev.conf` - Trustroots Nginx/Passenger config
- `/etc/nginx/nginx.conf` - Nginx main config
- `/var/log/nginx/error.log` - Nginx/Passenger log

#### Clean Vagrant box
If for some reason you want to have clean box & database, run:
```bash
vagrant destroy && vagrant up
```

#### Using IP instead of http://trustroots.dev
To use [http://192.168.33.10/](http://192.168.33.10/) instead of "trustroots.dev" hostname, before installing everything set `config.hostmanager.enabled = false` at [Vagrant file](Vagrantfile) and change domain also to `scripts/vagrantup/nginx_trustroots_dev.conf`.

You can [modify your sudoers file](https://github.com/smdahlen/vagrant-hostmanager#passwordless-sudo) to stop Vagrant asking for password each time.

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

#### Update Vagrant box
Although not necessary, if you want to check for updates, just type:
```bash
vagrant box outdated
```

It will tell you if you are running the latest version or not of the box. If it says you aren't, simply run:
```bash
vagrant box update
```

### Problems
Check [troubleshooting](https://github.com/Trustroots/trustroots/wiki/Troubleshooting).
