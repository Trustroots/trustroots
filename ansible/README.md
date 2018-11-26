## ansible

`playbooks/inithetzner.yml` is the initial setup for Hetzner
servers. It's useful to have different initialization playbooks for
different hosting providers.  If we continue with Digital Ocean we
will have `playbooks/initdigitalocean.yml`.



### examples of running ansible

```
# running ansible on all server in "--check" mode, not changing things
ansible-playbook --check playbooks/hetznerinit.yml
```

